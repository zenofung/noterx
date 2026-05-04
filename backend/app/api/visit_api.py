"""
Page visit tracking for anonymous PV/UV statistics.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import sqlite3

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.api.usage_tracker import get_client_ip

logger = logging.getLogger("noterx.visit")
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "baseline.db")
VISITOR_SALT = os.getenv("VISITOR_HASH_SALT", "noterx-visitor")

router = APIRouter()


class VisitPayload(BaseModel):
    path: str = "/"
    referrer: str = ""


async def _read_visit_payload(request: Request) -> VisitPayload:
    try:
        data = await request.json()
    except json.JSONDecodeError:
        body = (await request.body()).decode("utf-8", errors="ignore")
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            data = {}
    if not isinstance(data, dict):
        data = {}
    return VisitPayload.model_validate(data)


def _visitor_hash(ip: str, user_agent: str) -> str:
    raw = f"{VISITOR_SALT}:{ip}:{user_agent}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _user_agent_hash(user_agent: str) -> str:
    raw = f"{VISITOR_SALT}:{user_agent}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def log_visit(ip: str, user_agent: str, path: str, referrer: str = "") -> str:
    visitor_hash = _visitor_hash(ip, user_agent)
    safe_path = (path or "/")[:200]
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            """
            INSERT INTO visit_log (visitor_hash, user_agent_hash, path)
            VALUES (?, ?, ?)
            """,
            (visitor_hash, _user_agent_hash(user_agent or ""), safe_path),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning("Failed to log visit: %s", e)
    return visitor_hash


@router.post("/visit")
async def track_visit(request: Request):
    payload = await _read_visit_payload(request)
    ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    log_visit(ip, user_agent, payload.path, payload.referrer)
    return {"ok": True}
