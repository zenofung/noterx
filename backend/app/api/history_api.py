"""
诊断历史记录 CRUD API (MySQL & JWT 认证版)
"""
import json
import logging
import uuid
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Depends

from app.models.schemas import HistoryCreateRequest, HistoryListItem, HistoryDetail
from app.api.auth_api import get_current_user
from app.utils import mysql_helper

router = APIRouter()
logger = logging.getLogger("noterx.history")


@router.post("/history", response_model=dict)
async def create_history(
    req: HistoryCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    保存一条图文笔记诊断历史记录。
    """
    record_id = uuid.uuid4().hex
    report = req.report
    overall_score = report.get("overall_score", 0)
    grade = report.get("grade", "")

    try:
        mysql_helper.execute_update(
            "INSERT INTO diagnosis_history "
            "(id, user_id, title, category, overall_score, grade, report_json, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (
                record_id, current_user["id"], req.title, req.category,
                overall_score, grade, json.dumps(report, ensure_ascii=False),
                datetime.now()
            )
        )
    except Exception as e:
        logger.error("保存历史记录失败: %s", e)
        raise HTTPException(500, "保存失败")

    return {"id": record_id}


@router.get("/history", response_model=list[HistoryListItem])
async def list_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    获取图文诊断历史列表（按时间倒序）。
    """
    try:
        rows = mysql_helper.execute_query(
            "SELECT id, title, category, overall_score, grade, created_at "
            "FROM diagnosis_history "
            "WHERE user_id = %s "
            "ORDER BY created_at DESC "
            "LIMIT %s OFFSET %s",
            (current_user["id"], limit, offset)
        )
    except Exception as e:
        logger.error("读取历史列表失败: %s", e)
        return []

    # Map database datetimes to strings
    result = []
    for r in rows:
        created_at_str = r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(r["created_at"], datetime) else str(r["created_at"])
        result.append(HistoryListItem(
            id=r["id"],
            title=r["title"],
            category=r["category"],
            overall_score=r["overall_score"] or 0,
            grade=r["grade"] or "",
            created_at=created_at_str
        ))
    return result


@router.get("/history/video", response_model=list[HistoryListItem])
async def list_video_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    获取短视频拉片分析历史列表。
    """
    try:
        rows = mysql_helper.execute_query(
            "SELECT task_id AS id, video_title AS title, 'video' AS category, "
            "       viral_score AS overall_score, viral_level AS grade, created_at "
            "FROM video_analysis_history "
            "WHERE user_id = %s AND completed_at IS NOT NULL "
            "ORDER BY created_at DESC "
            "LIMIT %s OFFSET %s",
            (current_user["id"], limit, offset)
        )
    except Exception as e:
        logger.error("读取视频历史列表失败: %s", e)
        return []

    result = []
    for r in rows:
        created_at_str = r["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(r["created_at"], datetime) else str(r["created_at"])
        result.append(HistoryListItem(
            id=r["id"],
            title=r["title"] or "未获取到标题",
            category=r["category"],
            overall_score=r["overall_score"] or 0,
            grade=r["grade"] or "",
            created_at=created_at_str
        ))
    return result


@router.get("/history/{record_id}", response_model=HistoryDetail)
async def get_history(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    获取单条历史记录详情。
    """
    try:
        row = mysql_helper.execute_query_one(
            "SELECT id, title, category, overall_score, grade, report_json, created_at "
            "FROM diagnosis_history WHERE id = %s AND user_id = %s",
            (record_id, current_user["id"])
        )
    except Exception as e:
        logger.error("读取历史详情失败: %s", e)
        raise HTTPException(500, "读取失败")

    if not row:
        raise HTTPException(404, "记录不存在")

    created_at_str = row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(row["created_at"], datetime) else str(row["created_at"])

    return HistoryDetail(
        id=row["id"],
        title=row["title"],
        category=row["category"],
        overall_score=row["overall_score"] or 0,
        grade=row["grade"] or "",
        created_at=created_at_str,
        report=json.loads(row["report_json"]),
    )


@router.delete("/history/{record_id}")
async def delete_history(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    删除一条图文笔记诊断历史。
    """
    try:
        affected = mysql_helper.execute_update(
            "DELETE FROM diagnosis_history WHERE id = %s AND user_id = %s",
            (record_id, current_user["id"])
        )
        if affected == 0:
            raise HTTPException(404, "记录不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("删除历史记录失败: %s", e)
        raise HTTPException(500, "删除失败")

    return {"ok": True}


@router.delete("/history/video/{task_id}")
async def delete_video_history(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    删除一条短视频分析历史。
    """
    try:
        affected = mysql_helper.execute_update(
            "DELETE FROM video_analysis_history WHERE task_id = %s AND user_id = %s",
            (task_id, current_user["id"])
        )
        if affected == 0:
            raise HTTPException(404, "记录不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("删除视频历史失败: %s", e)
        raise HTTPException(500, "删除失败")

    return {"ok": True}

