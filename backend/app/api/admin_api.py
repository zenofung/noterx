"""
管理员后台管理系统 API (FastAPI 版)
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends, status
from pydantic import BaseModel

from app.api.auth_api import get_current_user, create_access_token
from app.utils import mysql_helper

router = APIRouter()
logger = logging.getLogger("noterx.admin")

ADMIN_PASSWORD_SHA512 = "d790764cc09bc49a5567536766f37dbdae22c72dcb8468b80d81c658f67e71d817b8ceaecb56ccff89ccf9a85025a6432272a481d858c8c405e2ddbcf0f4c187"

def _verify_password(password: str) -> bool:
    import hmac
    return hmac.compare_digest(
        hashlib.sha512(password.encode()).hexdigest(),
        ADMIN_PASSWORD_SHA512,
    )

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    """验证当前登录用户是否是管理员。"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="拒绝访问：无系统管理员权限"
        )
    return current_user


# Pydantic Schemas
class AdminLoginRequest(BaseModel):
    password: str


@router.post("/login")
async def admin_login(payload: AdminLoginRequest):
    """管理员登录验证，成功后返回 JWT Token。"""
    password = payload.password.strip()
    if not password:
        raise HTTPException(status_code=400, detail="密码不能为空")
    
    if not _verify_password(password):
        raise HTTPException(status_code=401, detail="管理员密码错误")
        
    token = create_access_token(user_id="admin", role="admin")
    return {
        "success": True,
        "token": token,
        "user": {
            "id": "admin",
            "nickname": "系统管理员",
            "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=admin",
            "role": "admin",
            "is_guest": False
        }
    }


@router.get("/stats")
async def get_system_stats(current_admin: dict = Depends(get_current_admin)):
    """获取管理后台仪表盘综合统计数据。"""
    try:
        # Total users & Guest users count
        user_stats = mysql_helper.execute_query_one(
            "SELECT COUNT(*) as total_users, SUM(CASE WHEN is_guest = TRUE THEN 1 ELSE 0 END) as total_guests FROM users"
        )
        total_users = user_stats["total_users"] or 0
        total_guests = user_stats["total_guests"] or 0
        total_members = total_users - total_guests

        # Total note diagnoses
        note_stats = mysql_helper.execute_query_one("SELECT COUNT(*) as c FROM diagnosis_history")
        total_notes = note_stats["c"] or 0

        # Total video analyses
        video_stats = mysql_helper.execute_query_one(
            "SELECT COUNT(*) as total, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed FROM video_analysis_history"
        )
        total_videos = video_stats["total"] or 0
        completed_videos = video_stats["completed"] or 0

        # Total feedbacks
        feedback_stats = mysql_helper.execute_query_one("SELECT COUNT(*) as c FROM customer_feedback")
        total_feedbacks = feedback_stats["c"] or 0

        # Category distribution of note diagnoses
        note_categories = mysql_helper.execute_query(
            "SELECT category, COUNT(*) as count FROM diagnosis_history GROUP BY category ORDER BY count DESC"
        )

        return {
            "success": True,
            "counts": {
                "total_users": total_users,
                "total_guests": total_guests,
                "total_members": total_members,
                "total_notes": total_notes,
                "total_videos": total_videos,
                "completed_videos": completed_videos,
                "total_feedbacks": total_feedbacks,
            },
            "note_categories": {r["category"]: r["count"] for r in note_categories}
        }
    except Exception as e:
        logger.error(f"Failed to fetch system stats: {str(e)}")
        raise HTTPException(status_code=500, detail="获取系统统计数据失败")


@router.get("/users")
async def list_users_admin(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    current_admin: dict = Depends(get_current_admin)
):
    """分页查询并搜索平台所有效用户。"""
    try:
        query_sql = "SELECT id, phone, nickname, avatar_url, role, is_guest, created_at FROM users"
        count_sql = "SELECT COUNT(*) as c FROM users"
        params = []
        
        if search:
            search_param = f"%{search.strip()}%"
            where_clause = " WHERE phone LIKE %s OR nickname LIKE %s"
            query_sql += where_clause
            count_sql += where_clause
            params.extend([search_param, search_param])
            
        query_sql += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
        params_with_paging = list(params) + [limit, offset]

        rows = mysql_helper.execute_query(query_sql, tuple(params_with_paging))
        total_row = mysql_helper.execute_query_one(count_sql, tuple(params))
        total = total_row["c"] if total_row else 0

        items = []
        for r in rows:
            created_at_str = r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(r["created_at"], datetime) else str(r["created_at"])
            items.append({
                "id": r["id"],
                "phone": r["phone"],
                "nickname": r["nickname"],
                "avatar_url": r["avatar_url"],
                "role": r["role"],
                "is_guest": bool(r["is_guest"]),
                "created_at": created_at_str
            })

        return {"success": True, "total": total, "items": items}
    except Exception as e:
        logger.error(f"Failed to query users: {str(e)}")
        raise HTTPException(status_code=500, detail="查询用户列表失败")


@router.get("/diagnoses")
async def list_diagnoses_admin(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    current_admin: dict = Depends(get_current_admin)
):
    """分页查询并搜索平台所有图文诊断报告。"""
    try:
        query_sql = (
            "SELECT h.id, h.user_id, h.title, h.category, h.overall_score, h.grade, h.report_json, h.created_at, u.nickname "
            "FROM diagnosis_history h LEFT JOIN users u ON h.user_id = u.id"
        )
        count_sql = "SELECT COUNT(*) as c FROM diagnosis_history"
        params = []
        
        if search:
            search_param = f"%{search.strip()}%"
            query_sql += " WHERE h.title LIKE %s OR h.category LIKE %s"
            count_sql += " WHERE title LIKE %s OR category LIKE %s"
            params.extend([search_param, search_param])
            
        query_sql += " ORDER BY h.created_at DESC LIMIT %s OFFSET %s"
        params_with_paging = list(params) + [limit, offset]

        rows = mysql_helper.execute_query(query_sql, tuple(params_with_paging))
        total_row = mysql_helper.execute_query_one(count_sql, tuple(params))
        total = total_row["c"] if total_row else 0

        items = []
        for r in rows:
            created_at_str = r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(r["created_at"], datetime) else str(r["created_at"])
            
            parsed_report = None
            if r["report_json"]:
                try:
                    parsed_report = json_loads_safe(r["report_json"])
                except Exception:
                    pass

            items.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "user_nickname": r["nickname"] or "未关联/已注销",
                "title": r["title"],
                "category": r["category"],
                "overall_score": r["overall_score"] or 0,
                "grade": r["grade"] or "",
                "created_at": created_at_str,
                "report_json": parsed_report
            })

        return {"success": True, "total": total, "items": items}
    except Exception as e:
        logger.error(f"Failed to query diagnoses: {str(e)}")
        raise HTTPException(status_code=500, detail="查询图文诊断列表失败")


@router.get("/video-analyses")
async def list_video_analyses_admin(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    current_admin: dict = Depends(get_current_admin)
):
    """分页查询并搜索平台所有短视频拉片分析任务。"""
    try:
        query_sql = (
            "SELECT v.task_id, v.user_id, v.video_url, v.video_title, v.author_name, "
            "       v.viral_score, v.viral_level, v.created_at, v.completed_at, v.report_json, u.nickname "
            "FROM video_analysis_history v LEFT JOIN users u ON v.user_id = u.id"
        )
        count_sql = "SELECT COUNT(*) as c FROM video_analysis_history"
        params = []
        
        if search:
            search_param = f"%{search.strip()}%"
            query_sql += " WHERE v.video_title LIKE %s OR v.author_name LIKE %s"
            count_sql += " WHERE video_title LIKE %s OR author_name LIKE %s"
            params.extend([search_param, search_param])
            
        query_sql += " ORDER BY v.created_at DESC LIMIT %s OFFSET %s"
        params_with_paging = list(params) + [limit, offset]

        rows = mysql_helper.execute_query(query_sql, tuple(params_with_paging))
        total_row = mysql_helper.execute_query_one(count_sql, tuple(params))
        total = total_row["c"] if total_row else 0

        items = []
        for r in rows:
            created_at_str = r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(r["created_at"], datetime) else str(r["created_at"])
            completed_at_str = r["completed_at"].strftime("%Y-%m-%d %H:%M:%S") if r["completed_at"] and isinstance(r["completed_at"], datetime) else (str(r["completed_at"]) if r["completed_at"] else None)
            
            parsed_report = None
            if r["report_json"]:
                try:
                    parsed_report = json_loads_safe(r["report_json"])
                except Exception:
                    pass

            items.append({
                "task_id": r["task_id"],
                "user_id": r["user_id"],
                "user_nickname": r["nickname"] or "游客/未关联",
                "video_url": r["video_url"],
                "video_title": r["video_title"] or "未拉取到标题",
                "author_name": r["author_name"] or "未拉取到作者",
                "viral_score": r["viral_score"],
                "viral_level": r["viral_level"],
                "created_at": created_at_str,
                "completed_at": completed_at_str,
                "report_json": parsed_report
            })

        return {"success": True, "total": total, "items": items}
    except Exception as e:
        logger.error(f"Failed to query video analyses: {str(e)}")
        raise HTTPException(status_code=500, detail="查询视频拉片列表失败")


@router.get("/feedbacks")
async def list_feedbacks_admin(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_admin: dict = Depends(get_current_admin)
):
    """分页查询平台所有用户提交的客服留言与诊断反馈。"""
    try:
        rows = mysql_helper.execute_query(
            "SELECT f.id, f.user_id, f.result_id, f.result_type, f.report_title, f.report_json, "
            "       f.message_content, f.contact_info, f.created_at, u.nickname "
            "FROM customer_feedback f LEFT JOIN users u ON f.user_id = u.id "
            "ORDER BY f.created_at DESC "
            "LIMIT %s OFFSET %s",
            (limit, offset)
        )
        total_row = mysql_helper.execute_query_one("SELECT COUNT(*) as c FROM customer_feedback")
        total = total_row["c"] if total_row else 0

        items = []
        for r in rows:
            created_at_str = r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(r["created_at"], datetime) else str(r["created_at"])
            
            parsed_report = None
            if r["report_json"]:
                try:
                    parsed_report = json_loads_safe(r["report_json"])
                except Exception:
                    pass

            items.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "user_nickname": r["nickname"] or "游客反馈",
                "result_id": r["result_id"],
                "result_type": r["result_type"],
                "report_title": r["report_title"],
                "report_json": parsed_report,
                "message_content": r["message_content"],
                "contact_info": r["contact_info"],
                "created_at": created_at_str
            })

        return {"success": True, "total": total, "items": items}
    except Exception as e:
        logger.error(f"Failed to query feedbacks: {str(e)}")
        raise HTTPException(status_code=500, detail="查询留言列表失败")


def json_loads_safe(data_str: str) -> any:
    """安全反序列化 JSON。"""
    import json
    return json.loads(data_str)
