from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    url: str
    detail: Optional[dict] = None  # Allow frontend to pass pre-fetched detail JSON


class AnalyzeResponse(BaseModel):
    task_id: str
    status: str


class VideoMeta(BaseModel):
    title: str = ""
    author: str = ""
    author_id: str = ""
    likes: Optional[int] = None
    comments: Optional[int] = None
    shares: Optional[int] = None
    duration: float = 0.0
    thumbnail_url: Optional[str] = None
    publish_time: Optional[int] = None  # Unix timestamp of publish time


class TranscriptWord(BaseModel):
    word: str
    start: float
    end: float


class TranscriptSegment(BaseModel):
    text: str
    start: float
    end: float
    words: list[TranscriptWord] = []


class FrameAnalysis(BaseModel):
    timestamp: float
    frame_path: str
    shot_type: str = ""
    camera_movement: str = ""
    composition: str = ""
    transition: str = ""
    text_overlay: Optional[str] = None
    visual_description: str = ""
    mood: str = ""
    key_elements: list[str] = []


class AIPrompts(BaseModel):
    visual: str = ""
    copywriting: str = ""
    recreation: str = ""


class SegmentAnalysis(BaseModel):
    start_time: float
    end_time: float
    frames: list[FrameAnalysis] = []
    transcript: Optional[str] = None
    ai_prompts: AIPrompts = AIPrompts()


class ViralDimension(BaseModel):
    """Single dimension score with analysis."""
    score: int = 0          # 0-100
    analysis: str = ""      # 分析说明


class ViralAnalysis(BaseModel):
    # ── 旧字段（保持兼容）──
    hook_score: int = 0
    hook_analysis: str = ""
    pacing_analysis: str = ""
    emotional_arc: str = ""
    key_viral_factors: list[str] = []
    target_audience: str = ""
    content_formula: str = ""
    recreation_blueprint: str = ""

    # ── 新增：综合评分 ──
    viral_score: int = 0                     # 爆款潜力综合评分 0-100
    viral_level: str = ""                    # 低 / 中 / 高
    score_disclaimer: str = "评分为参考，不承诺播放效果"

    # ── 新增：数据洞察 ──
    data_insight: str = ""                   # 基于点赞/转发/评论/发布时间的数据洞察

    # ── 新增：行动建议 ──
    action_suggestion: str = ""              # 重拍/继续发/改标题/改剪辑/换口吻/调整选题
    action_reason: str = ""                  # 建议依据说明

    # ── 新增：多维度分析 ──
    dim_hook: Optional[ViralDimension] = None           # 开头钩子
    dim_pacing: Optional[ViralDimension] = None         # 内容节奏
    dim_emotion: Optional[ViralDimension] = None        # 情绪强度
    dim_comment_bait: Optional[ViralDimension] = None   # 评论点
    dim_share_bait: Optional[ViralDimension] = None     # 转发点
    dim_cover_title: Optional[ViralDimension] = None    # 标题封面

    # ── 新增：优化建议套餐 ──
    new_title: str = ""                      # 建议新标题
    opening_3s: str = ""                     # 前3秒开头脚本
    full_script: str = ""                    # 完整口播文案
    comment_guide: str = ""                  # 评论区引导语

    # ── 新增：服务说明 ──
    service_notice: str = (
        "本费用为单次内容诊断服务费，报告由AI辅助生成，"
        "用户可联系客服申请人工复核"
    )


class FullAnalysisResult(BaseModel):
    task_id: str
    video_meta: VideoMeta = VideoMeta()
    transcript: list[TranscriptSegment] = []
    segments: list[SegmentAnalysis] = []
    viral_analysis: ViralAnalysis = ViralAnalysis()
    created_at: str = ""
