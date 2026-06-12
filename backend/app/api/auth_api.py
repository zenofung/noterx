import os
import time
import uuid
import random
import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, HTTPException, Depends, Header, Request, status
from pydantic import BaseModel, Field

from app.utils import mysql_helper

logger = logging.getLogger("noterx.auth")

router = APIRouter(prefix="/auth")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "noterx_auth_secret_key_2026_secure")
JWT_EXPIRE_SECONDS = int(os.getenv("JWT_EXPIRE_SECONDS", "604800")) # Default 7 days

def create_access_token(user_id: str, role: str) -> str:
    """Generate signed JWT token."""
    expire = datetime.utcnow() + timedelta(seconds=JWT_EXPIRE_SECONDS)
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_access_token(token: str) -> Optional[dict]:
    """Decode JWT token, returning payload or None if invalid."""
    try:
        # Support Bearer prefix
        if token.startswith("Bearer "):
            token = token[7:]
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT Token: {str(e)}")
        return None

# Dependency to get current user
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency to retrieve logged in user via JWT in Authorization header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header is missing"
        )
    
    payload = decode_access_token(authorization)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token"
        )
    
    user_id = payload["sub"]
    if user_id == "admin" and payload.get("role") == "admin":
        return {
            "id": "admin",
            "nickname": "系统管理员",
            "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=admin",
            "role": "admin",
            "is_guest": False
        }

    user = mysql_helper.execute_query_one(
        "SELECT id, phone, wechat_openid, nickname, avatar_url, role, is_guest, created_at FROM users WHERE id = %s",
        (user_id,)
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Cast is_guest boolean correctly
    user["is_guest"] = bool(user["is_guest"])
    return user

# Pydantic Schemas
class SendSmsRequest(BaseModel):
    phone: str = Field(..., description="Mobile phone number")

class SmsLoginRequest(BaseModel):
    phone: str = Field(..., description="Mobile phone number")
    code: str = Field(..., description="6-digit verification code")

class WeChatPollRequest(BaseModel):
    ticket: str = Field(..., description="WeChat scan ticket ID")

# Mock scan cache to simulate scan flow in local developer testing
# ticket_id -> { "step": 0, "scanned_at": timestamp }
_wechat_sim_cache = {}

@router.post("/sms/send")
async def send_sms(payload: SendSmsRequest):
    """Generate and 'send' SMS verification code (mocked via terminal console log)."""
    phone = payload.phone.strip()
    
    # Simple phone regex check (11 digits starting with 1)
    if not re.match(r"^1[3-9]\d{9}$", phone):
        raise HTTPException(status_code=400, detail="手机号格式不正确，请输入11位中国手机号")
    
    # Generate 6 digit code
    code = f"{random.randint(100000, 999999)}"
    
    # Set expiration: 5 minutes from now
    expire_at = datetime.now() + timedelta(minutes=5)
    
    # Save code to DB
    mysql_helper.execute_update(
        "INSERT INTO sms_verification_codes (phone, code, expire_at) VALUES (%s, %s, %s)",
        (phone, code, expire_at)
    )
    
    # Print mock SMS log
    logger.info(f"\n[SMS MOCK] ========================================\n"
                f"验证码发送成功！\n"
                f"手机号: {phone}\n"
                f"验证码: {code} (有效期 5 分钟)\n"
                f"===================================================")
    
    return {"success": True, "message": "验证码已发送（测试环境请查看后端终端控制台日志）"}


@router.post("/sms/login")
async def sms_login(payload: SmsLoginRequest, request: Request):
    """Verify code and login/register user."""
    phone = payload.phone.strip()
    code = payload.code.strip()
    
    if not phone or not code:
        raise HTTPException(status_code=400, detail="手机号和验证码不能为空")
        
    # Check SMS validation codes
    # Query unexpired, unused verification code
    now = datetime.now()
    valid_code = mysql_helper.execute_query_one(
        "SELECT id FROM sms_verification_codes "
        "WHERE phone = %s AND code = %s AND is_used = FALSE AND expire_at > %s "
        "ORDER BY created_at DESC LIMIT 1",
        (phone, code, now)
    )
    
    if not valid_code:
        raise HTTPException(status_code=400, detail="验证码无效或已过期")
        
    # Mark code as used
    mysql_helper.execute_update(
        "UPDATE sms_verification_codes SET is_used = TRUE WHERE id = %s",
        (valid_code["id"],)
    )
    
    # Find or create user
    user = mysql_helper.execute_query_one(
        "SELECT id, phone, nickname, avatar_url, role, is_guest FROM users WHERE phone = %s",
        (phone,)
    )
    
    is_new_user = False
    if not user:
        is_new_user = True
        user_id = str(uuid.uuid4())
        nickname = f"用户_{phone[-4:]}"
        avatar_url = f"https://api.dicebear.com/7.x/adventurer/svg?seed={user_id[:8]}" # Sleek default avatar
        role = "user"
        
        mysql_helper.execute_update(
            "INSERT INTO users (id, phone, nickname, avatar_url, role, is_guest) VALUES (%s, %s, %s, %s, %s, FALSE)",
            (user_id, phone, nickname, avatar_url, role)
        )
        user = {
            "id": user_id,
            "phone": phone,
            "nickname": nickname,
            "avatar_url": avatar_url,
            "role": role,
            "is_guest": False
        }
    
    # Record login log
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    mysql_helper.execute_update(
        "INSERT INTO login_logs (user_id, login_type, ip_address, user_agent) VALUES (%s, 'sms', %s, %s)",
        (user["id"], ip, ua)
    )
    
    # Create token
    token = create_access_token(user["id"], user["role"])
    
    return {
        "success": True,
        "is_new": is_new_user,
        "token": token,
        "user": {
            "id": user["id"],
            "phone": user["phone"],
            "nickname": user["nickname"],
            "avatar_url": user["avatar_url"],
            "role": user["role"],
            "is_guest": False
        }
    }


@router.post("/wechat/qr-code")
async def wechat_qrcode():
    """Request a scene ticket to display simulated WeChat login QR code."""
    ticket = f"qr_{uuid.uuid4().hex[:12]}"
    
    # Initialize the simulation state in cache
    # step 0: waiting for scan; step 1: scanned (waiting confirm); step 2: success
    _wechat_sim_cache[ticket] = {
        "step": 0,
        "created_at": time.time()
    }
    
    # In a real environment, you would call WeChat API to get a QR code URL
    # Here we return the ticket and a placeholder QR code image (using generic public QR API)
    # We point it to a mock scanning instruction page or just return text
    mock_qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://noterx.muran.tech/mock-scan/{ticket}"
    
    return {
        "success": True,
        "ticket": ticket,
        "qr_url": mock_qr_url,
        "expire_seconds": 300
    }


@router.post("/wechat/login-poll")
async def wechat_login_poll(payload: WeChatPollRequest, request: Request):
    """
    Poll WeChat login status.
    For local testing, we simulate scanning states dynamically on each poll:
      - 1st poll: returns 'waiting_scan'
      - 2nd poll: returns 'scanned' (waiting user to confirm)
      - 3rd poll: returns 'success' + token
    """
    ticket = payload.ticket.strip()
    
    if ticket not in _wechat_sim_cache:
        raise HTTPException(status_code=400, detail="无效或已过期的扫码会话")
        
    session = _wechat_sim_cache[ticket]
    elapsed = time.time() - session["created_at"]
    
    # Automatically simulate WeChat scan flow based on elapsed time:
    # 0s - 4s: Waiting Scan
    # 4s - 8s: User Scanned, confirming on mobile
    # > 8s: Approved, successful login
    if elapsed < 4:
        return {"success": True, "status": "waiting_scan", "message": "等待扫码中..."}
    elif elapsed < 8:
        return {"success": True, "status": "scanned", "message": "已扫码，请在手机上确认登录..."}
        
    # Simulate Login Success
    # Find or create WeChat user
    openid = f"openid_{ticket}"
    unionid = f"unionid_{ticket}"
    
    user = mysql_helper.execute_query_one(
        "SELECT id, phone, nickname, avatar_url, role, is_guest FROM users WHERE wechat_openid = %s",
        (openid,)
    )
    
    is_new = False
    if not user:
        is_new = True
        user_id = str(uuid.uuid4())
        nickname = f"微信用户_{ticket[-4:]}"
        # A cute cat avatar seed
        avatar_url = f"https://api.dicebear.com/7.x/bottts/svg?seed={ticket}"
        role = "user"
        
        mysql_helper.execute_update(
            "INSERT INTO users (id, wechat_openid, wechat_unionid, nickname, avatar_url, role, is_guest) VALUES (%s, %s, %s, %s, %s, %s, FALSE)",
            (user_id, openid, unionid, nickname, avatar_url, role)
        )
        user = {
            "id": user_id,
            "nickname": nickname,
            "avatar_url": avatar_url,
            "role": role,
            "is_guest": False
        }
        
    # Record login log
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    mysql_helper.execute_update(
        "INSERT INTO login_logs (user_id, login_type, ip_address, user_agent) VALUES (%s, 'wechat', %s, %s)",
        (user["id"], ip, ua)
    )
    
    # Generate token
    token = create_access_token(user["id"], user["role"])
    
    # Clean up simulation cache
    if ticket in _wechat_sim_cache:
        del _wechat_sim_cache[ticket]
        
    return {
        "success": True,
        "status": "success",
        "token": token,
        "user": {
            "id": user["id"],
            "nickname": user["nickname"],
            "avatar_url": user["avatar_url"],
            "role": user["role"],
            "is_guest": False
        }
    }


@router.post("/guest/login")
async def guest_login(request: Request):
    """Create a temporary guest user and return a JWT token."""
    user_id = str(uuid.uuid4())
    random_hex = uuid.uuid4().hex[:6]
    nickname = f"游客_{random_hex}"
    avatar_url = f"https://api.dicebear.com/7.x/identicon/svg?seed={user_id[:8]}"
    role = "user"
    
    # Insert guest user into database
    mysql_helper.execute_update(
        "INSERT INTO users (id, nickname, avatar_url, role, is_guest) VALUES (%s, %s, %s, %s, TRUE)",
        (user_id, nickname, avatar_url, role)
    )
    
    # Record login log
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    mysql_helper.execute_update(
        "INSERT INTO login_logs (user_id, login_type, ip_address, user_agent) VALUES (%s, 'guest', %s, %s)",
        (user_id, ip, ua)
    )
    
    # Generate Token
    token = create_access_token(user_id, role)
    
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "nickname": nickname,
            "avatar_url": avatar_url,
            "role": role,
            "is_guest": True
        }
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Fetch profile of current logged-in user."""
    return {"success": True, "user": current_user}
