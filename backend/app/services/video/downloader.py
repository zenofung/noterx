from __future__ import annotations
import asyncio
import json
import os
import re

import httpx
from playwright.async_api import async_playwright

from app.config_video import settings
from app.models.schemas_video import VideoMeta

_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"


def _load_douyin_cookie_header() -> str:
    """Load Douyin Cookie header from file path or inline value in .env."""
    raw = (settings.DOUYIN_COOKIE_FILE or "").strip().strip("'\"")
    if not raw:
        return ""

    candidates = [raw]
    if not os.path.isabs(raw):
        # __file__ is backend/app/services/video/downloader.py
        current_dir = os.path.dirname(os.path.abspath(__file__))
        app_dir = os.path.dirname(os.path.dirname(current_dir))  # backend/app
        backend_root = os.path.dirname(app_dir)  # backend/
        repo_root = os.path.dirname(backend_root)  # repo root
        
        candidates.append(os.path.join(backend_root, raw))
        candidates.append(os.path.join(repo_root, raw))
        candidates.append(os.path.join(app_dir, raw))

    for path in candidates:
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                cookie_val = f.read().strip()
                print(f"[Cookie Loader] Successfully loaded cookies from {path} (length: {len(cookie_val)})")
                return cookie_val

    # Backward compat: treat env value as raw Cookie header if it looks like one.
    if "=" in raw:
        print(f"[Cookie Loader] Treating env value directly as raw Cookie header (length: {len(raw)})")
        return raw
    
    print(f"[Cookie Loader] WARNING: Could not find cookies file in candidates: {candidates}")
    return ""



def _parse_cookie_header(cookie_header: str) -> list[dict]:
    cookies = []
    for part in cookie_header.split(";"):
        part = part.strip()
        if not part or "=" not in part:
            continue
        name, _, value = part.partition("=")
        cookies.append({
            "name": name.strip(),
            "value": value.strip(),
            "domain": ".douyin.com",
            "path": "/",
        })
    return cookies


def _format_exception(exc: Exception) -> str:
    msg = str(exc).strip()
    if msg:
        return msg
    return f"{type(exc).__name__}：下载过程异常，请确认 Cookie 有效并重试"


async def download_video(url: str, output_dir: str) -> VideoMeta:
    """Download Douyin video: fetch detail via Playwright → extract URL → download."""
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "video.mp4")

    # Step 1: Get detail JSON
    detail_path = os.path.join(output_dir, "detail.json")
    if os.path.exists(detail_path):
        with open(detail_path, "r", encoding="utf-8") as f:
            detail = json.load(f)
    else:
        detail = await _fetch_detail_playwright(url)
        if detail:
            with open(detail_path, "w", encoding="utf-8") as f:
                json.dump(detail, f, ensure_ascii=False)

    if not detail or "aweme_detail" not in detail:
        raise RuntimeError(
            "无法获取视频详情。请确认：1) 链接可正常打开 2) cookies.txt 为最新登录 Cookie 3) 视频未下架/私密"
        )

    aweme = detail["aweme_detail"]
    meta = _parse_meta(aweme)

    # Step 2: Download video
    video_url = _get_best_video_url(aweme)
    if not video_url:
        raise RuntimeError("未找到视频下载地址")

    await _download_file(video_url, output_path)

    if not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
        raise RuntimeError("视频下载失败或文件过小")

    return meta


async def _fetch_detail_playwright(url: str) -> dict | None:
    """Use Playwright to open Douyin page and intercept the detail API response."""
    aweme_id = _extract_aweme_id(url)
    if not aweme_id:
        aweme_id = await _resolve_short_url(url)
    if not aweme_id:
        raise RuntimeError(f"无法从链接提取视频ID: {url}")

    # Ensure URL is in full format
    if "douyin.com/video/" not in url:
        url = f"https://www.douyin.com/video/{aweme_id}"

    detail_json = None
    filter_reason = None
    cookie_header = _load_douyin_cookie_header()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context_kwargs = {
            "user_agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            "viewport": {"width": 1440, "height": 900},
            "locale": "zh-CN",
        }
        context = await browser.new_context(**context_kwargs)
        if cookie_header:
            await context.add_cookies(_parse_cookie_header(cookie_header))
        page = await context.new_page()

        response_future = asyncio.get_running_loop().create_future()

        async def handle_response(response):
            nonlocal detail_json, filter_reason
            if response_future.done():
                return
            if "aweme/v1/web/aweme/detail" not in response.url:
                return
            try:
                body = await response.json()
            except Exception:
                return
            if body.get("aweme_detail"):
                detail_json = body
                if not response_future.done():
                    response_future.set_result(body)
                return
            filter_detail = body.get("filter_detail") or {}
            if filter_detail.get("filter_reason"):
                filter_reason = filter_detail["filter_reason"]

        page.on("response", handle_response)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            try:
                await asyncio.wait_for(asyncio.shield(response_future), timeout=30)
            except asyncio.TimeoutError:
                detail_json = detail_json or await _extract_from_ssr(page, aweme_id)
        except Exception as exc:
            raise RuntimeError(_format_exception(exc)) from exc
        finally:
            await browser.close()

    if not detail_json and filter_reason:
        raise RuntimeError(
            f"抖音限制了该视频访问 (原因: {filter_reason})，请换一个公开视频或更新 Cookie 后重试"
        )

    return detail_json


async def _extract_from_ssr(page, aweme_id: str) -> dict | None:
    """Try to extract video detail from page's SSR RENDER_DATA."""
    try:
        content = await page.evaluate("""() => {
            const el = document.querySelector('script[id="RENDER_DATA"]');
            if (!el) return null;
            return decodeURIComponent(el.textContent);
        }""")
        if not content:
            return None
        data = json.loads(content)
        # Search for video detail in the data tree
        return _find_aweme_detail(data, aweme_id)
    except Exception:
        return None


def _find_aweme_detail(data: dict, aweme_id: str) -> dict | None:
    """Recursively search for aweme_detail in SSR data."""
    if isinstance(data, dict):
        if "aweme_detail" in data or "awemeDetail" in data:
            detail = data.get("aweme_detail") or data.get("awemeDetail")
            if detail and isinstance(detail, dict):
                return {"aweme_detail": detail}
        for v in data.values():
            result = _find_aweme_detail(v, aweme_id)
            if result:
                return result
    elif isinstance(data, list):
        for item in data:
            result = _find_aweme_detail(item, aweme_id)
            if result:
                return result
    return None


def _extract_aweme_id(url: str) -> str | None:
    match = re.search(r"video/(\d+)", url)
    return match.group(1) if match else None


async def _resolve_short_url(url: str) -> str | None:
    """Resolve v.douyin.com short URL to get aweme_id."""
    try:
        headers = {"User-Agent": _UA}
        cookie_header = _load_douyin_cookie_header()
        if cookie_header:
            headers["Cookie"] = cookie_header
        async with httpx.AsyncClient(
            follow_redirects=True,
            headers=headers,
        ) as client:
            resp = await client.head(url, timeout=10)
            final_url = str(resp.url)
            return _extract_aweme_id(final_url)
    except Exception as e:
        import traceback
        print(f"[Resolve Short URL] Error resolving {url}: {e}")
        traceback.print_exc()
        return None



def _parse_meta(aweme: dict) -> VideoMeta:
    stats = aweme.get("statistics", {})
    video = aweme.get("video", {})
    author = aweme.get("author", {})
    duration = video.get("duration", 0)
    if duration > 1000:
        duration = duration / 1000
    return VideoMeta(
        title=aweme.get("desc", ""),
        author=author.get("nickname", ""),
        author_id=author.get("sec_uid", author.get("uid", "")),
        likes=stats.get("digg_count"),
        comments=stats.get("comment_count"),
        shares=stats.get("share_count"),
        duration=duration,
        thumbnail_url=video.get("cover", {}).get("url_list", [None])[0],
    )


def _get_best_video_url(aweme: dict) -> str | None:
    video = aweme.get("video", {})
    bit_rate = video.get("bit_rate", [])
    if bit_rate:
        sorted_rates = sorted(bit_rate, key=lambda x: x.get("bit_rate", 0), reverse=True)
        for rate in sorted_rates:
            urls = rate.get("play_addr", {}).get("url_list", [])
            for u in urls:
                if "douyinvod.com" in u:
                    return u
            if urls:
                return urls[0]
    play_addr = video.get("play_addr", {})
    urls = play_addr.get("url_list", [])
    for u in urls:
        if "douyinvod.com" in u:
            return u
    return urls[0] if urls else None


async def _download_file(url: str, output_path: str):
    headers = {
        "User-Agent": _UA,
        "Referer": "https://www.douyin.com/",
    }
    cookie_header = _load_douyin_cookie_header()
    if cookie_header:
        headers["Cookie"] = cookie_header

    async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
        async with client.stream("GET", url, headers=headers) as resp:
            if resp.status_code >= 400:
                raise RuntimeError(f"下载失败: HTTP {resp.status_code}")
            with open(output_path, "wb") as f:
                async for chunk in resp.aiter_bytes():
                    f.write(chunk)
