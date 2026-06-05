from __future__ import annotations
import asyncio
import functools
import json
import os
import re
import subprocess
from glob import glob

from app.utils.ffmpeg_helper import resolve_binary_path
from app.config_video import settings


def _run_cmd_sync(cmd: list[str]) -> tuple[bytes, bytes]:
    """Run a subprocess synchronously (safe in thread pool on Windows)."""
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{result.stderr.decode(errors='replace')}")
    return result.stdout, result.stderr


async def _run_cmd(cmd: list[str]) -> tuple[bytes, bytes]:
    """Async wrapper: runs ffmpeg/ffprobe in a thread pool to avoid Windows event loop issues."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        functools.partial(_run_cmd_sync, cmd),
    )


async def get_video_duration(video_path: str) -> float:
    cmd = [
        resolve_binary_path("ffprobe"), "-v", "quiet", "-print_format", "json",
        "-show_format", video_path,
    ]
    stdout, _ = await _run_cmd(cmd)
    info = json.loads(stdout)
    return float(info["format"]["duration"])


async def extract_audio(video_path: str, output_dir: str) -> str:
    """Extract audio as 16kHz mono WAV for ASR."""
    audio_path = os.path.join(output_dir, "audio.wav")
    cmd = [
        resolve_binary_path("ffmpeg"), "-y", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        audio_path,
    ]
    await _run_cmd(cmd)
    return audio_path


async def extract_frames(video_path: str, frames_dir: str) -> list[dict]:
    """Extract frames at configurable interval + optional scene change detection."""
    os.makedirs(frames_dir, exist_ok=True)

    duration = await get_video_duration(video_path)

    interval = float(getattr(settings, "VIDEO_FRAME_INTERVAL_SECONDS", 3.0))
    scene_detect = bool(getattr(settings, "VIDEO_SCENE_DETECT_ENABLED", True))

    # Configurable interval extraction (e.g. 1 frame per 30 seconds: fps=1/30)
    fps_cmd = [
        resolve_binary_path("ffmpeg"), "-y", "-i", video_path,
        "-vf", f"fps=1/{interval},scale=1280:-2",
        "-q:v", "2", "-start_number", "1",
        os.path.join(frames_dir, "%03d.jpg"),
    ]
    await _run_cmd(fps_cmd)

    # Rename with timestamps
    frames = []
    raw_files = sorted(glob(os.path.join(frames_dir, "[0-9]*.jpg")))
    for i, f in enumerate(raw_files):
        ts = float(i * interval)
        new_name = os.path.join(frames_dir, f"{i + 1:03d}_{ts:.1f}s.jpg")
        os.rename(f, new_name)
        frames.append({"path": new_name, "timestamp": ts})

    # Optional scene change detection
    if scene_detect:
        scene_cmd = [
            resolve_binary_path("ffmpeg"), "-y", "-i", video_path,
            "-vf", "select='gt(scene,0.3)',showinfo,scale=1280:-2",
            "-vsync", "vfn", "-q:v", "2",
            os.path.join(frames_dir, "scene_%03d.jpg"),
        ]
        loop = asyncio.get_event_loop()
        scene_result = await loop.run_in_executor(
            None,
            functools.partial(
                subprocess.run,
                scene_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            ),
        )
        stderr_data = scene_result.stderr

        # Parse timestamps from showinfo
        scene_times = []
        for line in stderr_data.decode(errors="replace").split("\n"):
            match = re.search(r"pts_time:(\d+\.?\d*)", line)
            if match:
                scene_times.append(float(match.group(1)))

        # Merge scene frames if not too close to existing frames
        scene_files = sorted(glob(os.path.join(frames_dir, "scene_*.jpg")))
        for j, (scene_file, ts) in enumerate(zip(scene_files, scene_times)):
            nearest_dist = min((abs(f["timestamp"] - ts) for f in frames), default=999)
            if nearest_dist > 0.3:
                new_name = os.path.join(frames_dir, f"s{j + 1:03d}_{ts:.1f}s.jpg")
                os.rename(scene_file, new_name)
                frames.append({"path": new_name, "timestamp": ts})
            else:
                os.remove(scene_file)

        # Clean up remaining scene files
        for f in glob(os.path.join(frames_dir, "scene_*.jpg")):
            os.remove(f)

    frames.sort(key=lambda f: f["timestamp"])
    return frames
