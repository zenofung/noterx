from __future__ import annotations
import asyncio
import functools
import json
from datetime import datetime, timezone
from typing import Optional

from openai import OpenAI

from app.config_video import settings
from app.models.schemas_video import VideoMeta, ViralAnalysis, ViralDimension

VIRAL_ANALYSIS_SYSTEM = """你是一位顶级的短视频运营专家和爆款分析师，曾深度分析过超过10000条百万赞爆款短视频。

你的任务是对用户提交的短视频进行全面的【内容诊断】，帮助他们判断视频质量、找出问题并给出可落地的优化建议。

请严格按以下JSON格式输出，所有字段必须填写完整，不得省略：
{
  "viral_score": 72,
  "viral_level": "中",
  "data_insight": "基于数据的洞察：视频发布X天，点赞X，转发X，评论X，日均互动量X，处于[低/中/高]水平",
  "action_suggestion": "继续发",
  "action_reason": "该视频数据表现中等，选题有潜力，建议优化封面标题后继续发布",
  "hook_score": 7,
  "hook_analysis": "前3秒钩子分析（具体描述开头如何抓住注意力，存在什么问题）",
  "pacing_analysis": "节奏分析：信息密度、画面切换频率、音乐节奏配合",
  "emotional_arc": "情绪曲线：从开头到结尾的情绪变化轨迹",
  "key_viral_factors": ["爆点因素1", "爆点因素2", "爆点因素3"],
  "target_audience": "目标受众画像描述",
  "content_formula": "这条视频的底层内容公式",
  "recreation_blueprint": "复刻指南：\\n1. 第一步\\n2. 第二步",
  "dim_hook": {"score": 65, "analysis": "开头钩子问题与建议"},
  "dim_pacing": {"score": 70, "analysis": "内容节奏问题与建议"},
  "dim_emotion": {"score": 55, "analysis": "情绪强度问题与建议"},
  "dim_comment_bait": {"score": 40, "analysis": "评论点问题与建议（什么内容会引发用户评论）"},
  "dim_share_bait": {"score": 50, "analysis": "转发点问题与建议（什么内容会引发用户转发）"},
  "dim_cover_title": {"score": 60, "analysis": "标题封面问题与建议"},
  "new_title": "建议的新标题（吸引眼球、包含关键词，30字以内）",
  "opening_3s": "建议的前3秒开头脚本（具体的说话内容或画面描述）",
  "full_script": "完整的优化后口播文案（可直接录制使用）",
  "comment_guide": "评论区引导语（发布时置顶的第一条评论内容）"
}

注意：
- viral_score 为0-100的整数，综合考虑内容质量、数据表现、爆款潜力
- viral_level 只能是 "低"、"中"、"高" 三选一（0-39低，40-69中，70-100高）
- action_suggestion 只能是以下之一："重拍"、"继续发"、"改标题"、"改剪辑"、"换口吻"、"调整选题"
- dim_* 中的 score 为0-100整数
- full_script 要有实质内容，不少于100字"""


def _get_client() -> OpenAI:
    return OpenAI(
        base_url=settings.DOUBAO_BASE_URL,
        api_key=settings.DOUBAO_API_KEY,
    )


def _days_since_publish(publish_time: int | None) -> str:
    """Calculate how many days since publish."""
    if not publish_time:
        return "未知"
    try:
        pub_dt = datetime.fromtimestamp(publish_time, tz=timezone.utc)
        now_dt = datetime.now(tz=timezone.utc)
        delta = now_dt - pub_dt
        days = delta.days
        if days == 0:
            return "今天"
        elif days == 1:
            return "昨天"
        else:
            return f"{days}天前"
    except Exception:
        return "未知"


def _analyze_viral_sync(
    meta: VideoMeta,
    full_transcript: str,
    segments_summary: str,
) -> ViralAnalysis:
    """Synchronous viral analysis (runs in thread pool)."""
    client = _get_client()

    likes_str = f"{meta.likes:,}" if meta.likes is not None else "未知"
    comments_str = f"{meta.comments:,}" if meta.comments is not None else "未知"
    shares_str = f"{meta.shares:,}" if meta.shares is not None else "未知"
    publish_str = _days_since_publish(meta.publish_time)

    # Calculate engagement rate hint
    engagement_hint = ""
    if meta.likes is not None and meta.publish_time:
        try:
            delta_days = max(
                1,
                (datetime.now(tz=timezone.utc) -
                 datetime.fromtimestamp(meta.publish_time, tz=timezone.utc)).days,
            )
            daily_avg = meta.likes / delta_days
            if daily_avg < 100:
                engagement_hint = "（日均点赞不足100，数据表现较差）"
            elif daily_avg < 1000:
                engagement_hint = "（日均点赞约100-1000，数据表现中等）"
            elif daily_avg < 10000:
                engagement_hint = "（日均点赞约1000-10000，数据表现良好）"
            else:
                engagement_hint = "（日均点赞超过1万，高爆款数据）"
        except Exception:
            pass

    user_content = f"""视频信息：
- 标题：{meta.title}
- 作者：{meta.author}
- 发布时间：{publish_str}
- 点赞数：{likes_str} {engagement_hint}
- 评论数：{comments_str}
- 转发数：{shares_str}
- 视频时长：{meta.duration:.1f}秒

完整口播/字幕文案：
{full_transcript or '（无语音内容）'}

逐秒画面分析摘要：
{segments_summary}

请对该视频进行全面诊断，输出完整的JSON格式分析报告。"""

    response = client.chat.completions.create(
        model=settings.DOUBAO_VISION_ENDPOINT,
        messages=[
            {"role": "system", "content": VIRAL_ANALYSIS_SYSTEM},
            {"role": "user", "content": user_content},
        ],
        temperature=0.5,
        max_tokens=3000,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Return minimal fallback
        return ViralAnalysis(
            hook_score=0,
            hook_analysis=raw[:500],
            viral_score=0,
            viral_level="低",
        )

    # Parse nested ViralDimension objects
    for dim_key in ("dim_hook", "dim_pacing", "dim_emotion",
                    "dim_comment_bait", "dim_share_bait", "dim_cover_title"):
        if dim_key in data and isinstance(data[dim_key], dict):
            data[dim_key] = ViralDimension(**data[dim_key])
        else:
            data.pop(dim_key, None)

    # Ensure viral_level is valid
    if data.get("viral_level") not in ("低", "中", "高"):
        score = data.get("viral_score", 0)
        data["viral_level"] = "高" if score >= 70 else ("中" if score >= 40 else "低")

    # Keep service notices (static, always injected)
    data["score_disclaimer"] = "评分为参考，不承诉播放效果"
    data["service_notice"] = (
        "本费用为单次内容诊断服务费，报告由AI辅助生成，"
        "用户可联系客服申请人工复核"
    )

    return ViralAnalysis(**data)


async def analyze_viral(
    meta: VideoMeta,
    full_transcript: str,
    segments_summary: str,
) -> ViralAnalysis:
    """Async wrapper for viral analysis."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        functools.partial(_analyze_viral_sync, meta, full_transcript, segments_summary),
    )
