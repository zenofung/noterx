import asyncio
import json
import os
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Header
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from app.config_video import settings
from app.models.schemas_video import AnalyzeRequest, AnalyzeResponse
from app.services.video.pipeline import run_pipeline
from app.api.auth_api import decode_access_token
from app.utils import mysql_helper

router = APIRouter()

# In-memory task store for SSE progress streaming
tasks: dict[str, dict] = {}


@router.post("/analyze", response_model=AnalyzeResponse)
async def start_analysis(
    req: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    task_id = str(uuid.uuid4())[:8]
    
    # 1. Parse user_id if token is valid
    user_id = None
    if authorization:
        payload = decode_access_token(authorization)
        if payload and "sub" in payload:
            user_id = payload["sub"]
            
    event_queue = asyncio.Queue()
    tasks[task_id] = {
        "status": "queued",
        "events": event_queue,
    }

    # If detail JSON was provided, save it for the downloader
    if req.detail:
        task_dir = os.path.join(settings.DATA_DIR, task_id)
        os.makedirs(task_dir, exist_ok=True)
        detail_path = os.path.join(task_dir, "detail.json")
        with open(detail_path, "w", encoding="utf-8") as f:
            json.dump(req.detail, f, ensure_ascii=False)

    # 2. Insert initial task record into MySQL database
    try:
        mysql_helper.execute_update(
            "INSERT INTO video_analysis_history (task_id, user_id, video_url, created_at) "
            "VALUES (%s, %s, %s, CURRENT_TIMESTAMP)",
            (task_id, user_id, req.url)
        )
    except Exception as e:
        # Fail-safe: prevent database issues from breaking the core API
        print(f"[MySQL History ERROR] Failed to insert task start record: {str(e)}")

    background_tasks.add_task(run_pipeline, task_id, req.url, event_queue)
    return AnalyzeResponse(task_id=task_id, status="queued")


@router.get("/analyze/{task_id}/stream")
async def stream_progress(task_id: str):
    if task_id not in tasks:
        raise HTTPException(404, "Task not found")

    async def event_generator():
        queue = tasks[task_id]["events"]
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=300)
                yield {
                    "event": event["type"],
                    "data": json.dumps(event["data"], ensure_ascii=False),
                }
                if event["type"] in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": "{}"}

    return EventSourceResponse(event_generator())


@router.get("/results/{task_id}")
async def get_results(task_id: str):
    # 1. Try local cache file
    result_path = os.path.join(settings.DATA_DIR, task_id, "result.json")
    if os.path.exists(result_path):
        with open(result_path, "r", encoding="utf-8") as f:
            return json.load(f)
            
    # 2. Fallback: check MySQL database
    try:
        record = mysql_helper.execute_query_one(
            "SELECT report_json FROM video_analysis_history WHERE task_id = %s",
            (task_id,)
        )
        if record and record.get("report_json"):
            return json.loads(record["report_json"])
    except Exception as e:
        print(f"[MySQL History ERROR] Failed to fetch report: {str(e)}")
        
    raise HTTPException(404, "Results not found")


@router.get("/video/{task_id}")
async def get_video(task_id: str):
    video_path = os.path.join(settings.DATA_DIR, task_id, "video.mp4")
    if not os.path.exists(video_path):
        raise HTTPException(404, "Video not found")
    return FileResponse(video_path, media_type="video/mp4")


@router.get("/frame/{task_id}/{filename}")
async def get_frame(task_id: str, filename: str):
    frame_path = os.path.join(settings.DATA_DIR, task_id, "frames", filename)
    if not os.path.exists(frame_path):
        raise HTTPException(404, "Frame not found")
    return FileResponse(frame_path, media_type="image/jpeg")
