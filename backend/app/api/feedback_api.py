"""
联系客服留言与反馈 API
"""
import json
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel

from app.api.auth_api import decode_access_token
from app.utils import mysql_helper

router = APIRouter()
logger = logging.getLogger("noterx.feedback")

# Pydantic schema for submitting feedback
class FeedbackSubmitRequest(BaseModel):
    result_id: Optional[str] = None
    result_type: str  # 'note' or 'video'
    report_title: Optional[str] = ""
    report_json: Optional[dict] = None
    message_content: str
    contact_info: str

@router.post("/submit", response_model=dict)
async def submit_feedback(
    req: FeedbackSubmitRequest,
    authorization: Optional[str] = Header(None)
):
    """
    提交一条联系客服留言，可选关联当前的 AI 诊断分析结果。
    """
    message_content = req.message_content.strip()
    contact_info = req.contact_info.strip()

    if not message_content:
        raise HTTPException(status_code=400, detail="留言内容不能为空")
    if not contact_info:
        raise HTTPException(status_code=400, detail="联系方式（手机号/邮箱）不能为空")
    if req.result_type not in ("note", "video"):
        raise HTTPException(status_code=400, detail="报告类型必须为 'note' 或 'video'")

    # Optionally parse user_id if valid Authorization header is passed
    user_id = None
    if authorization:
        try:
            payload = decode_access_token(authorization)
            if payload and "sub" in payload:
                user_id = payload["sub"]
        except Exception as e:
            logger.warning(f"Failed to parse auth token during feedback submit: {str(e)}")

    # Prepare report json string
    report_str = json.dumps(req.report_json, ensure_ascii=False) if req.report_json else None

    try:
        mysql_helper.execute_update(
            "INSERT INTO customer_feedback "
            "(user_id, result_id, result_type, report_title, report_json, message_content, contact_info, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)",
            (
                user_id, req.result_id, req.result_type, req.report_title or "",
                report_str, message_content, contact_info
            )
        )
    except Exception as e:
        logger.error(f"Failed to save customer feedback: {str(e)}")
        raise HTTPException(status_code=500, detail="留言保存失败，请稍后重试")

    return {"success": True, "message": "提交成功！客服会尽快联系您。"}


@router.get("/list", response_model=dict)
async def list_feedback(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    获取客服留言记录列表，按时间倒序排列（用于后台统计与跟进显示）。
    """
    try:
        rows = mysql_helper.execute_query(
            "SELECT id, user_id, result_id, result_type, report_title, report_json, message_content, contact_info, created_at "
            "FROM customer_feedback "
            "ORDER BY created_at DESC "
            "LIMIT %s OFFSET %s",
            (limit, offset)
        )
    except Exception as e:
        logger.error(f"Failed to query customer feedback list: {str(e)}")
        raise HTTPException(status_code=500, detail="查询留言列表失败")

    results = []
    for r in rows:
        created_at_str = r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(r["created_at"], datetime) else str(r["created_at"])
        
        parsed_report = None
        if r["report_json"]:
            try:
                parsed_report = json.loads(r["report_json"])
            except Exception:
                pass

        results.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "result_id": r["result_id"],
            "result_type": r["result_type"],
            "report_title": r["report_title"],
            "report_json": parsed_report,
            "message_content": r["message_content"],
            "contact_info": r["contact_info"],
            "created_at": created_at_str
        })

    return {"success": True, "items": results}
