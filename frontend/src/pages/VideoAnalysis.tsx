import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  Divider,
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ErrorIcon from "@mui/icons-material/Error";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import ShareIcon from "@mui/icons-material/Share";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";

import {
  getVideoAnalysisResults,
  getVideoStreamUrl,
  getFrameImageUrl,
} from "../utils/api";
import type {
  FullAnalysisResult,
  ProgressStage,
} from "../utils/api";
import ContactFeedback from "../components/ContactFeedback";

const STAGE_CONFIG: Record<string, { label: string; tip: string }> = {
  downloading:       { label: "读取视频链接", tip: "正在访问抖音获取视频信息..." },
  extracting:        { label: "提取音频与关键帧", tip: "拆解视频每一帧画面，供AI逐帧分析..." },
  transcribing:      { label: "语音识别 · 口播文案", tip: "AI正在将视频语音转化为完整文案..." },
  analyzing_frames:  { label: "AI 视觉画面分析", tip: "逐帧分析景别、运镜、情绪、构图..." },
  generating_prompts:{ label: "分析内容节奏", tip: "生成创作参考建议..." },
  viral_analysis:    { label: "综合诊断 · 生成报告", tip: "AI综合评估爆款潜力并生成诊断报告，请耐心等待..." },
};

const SSE_TIPS = [
  "📊 AI正在对比数据指标，评估内容质量...",
  "🎬 逐帧拆解画面节奏与情绪曲线...",
  "✍️ 生成优化版标题与口播文案中...",
  "🔥 计算爆款潜力评分，请稍等片刻...",
  "💡 分析开头钩子与转发驱动力...",
  "📝 整理诊断报告，即将呈现结果...",
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCount(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return n.toLocaleString();
}

function formatPublishTime(ts: number | null | undefined): string {
  if (!ts) return "未知";
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diffDays = Math.floor((now - ts * 1000) / 86400000);
  const dateStr = d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  if (diffDays === 0) return `今天 ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return `昨天 · ${dateStr}`;
  if (diffDays < 7) return `${diffDays}天前 · ${dateStr}`;
  return `${dateStr} (${diffDays}天前)`;
}

function ScoreBadge({ score, level }: { score: number; level: string }) {
  const color = level === "高" ? "#16a34a" : level === "中" ? "#f59e0b" : "#dc2626";
  const bg = level === "高" ? "#f0fdf4" : level === "中" ? "#fffbeb" : "#fef2f2";
  const border = level === "高" ? "#bbf7d0" : level === "中" ? "#fde68a" : "#fecaca";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Box sx={{
        width: 88, height: 88, borderRadius: "50%",
        border: `4px solid ${border}`,
        bgcolor: bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1.1 }}>{score}</Typography>
        <Typography sx={{ fontSize: 10, color, fontWeight: 700 }}>/ 100</Typography>
      </Box>
      <Box>
        <Chip
          label={`爆款潜力：${level}`}
          size="small"
          sx={{ bgcolor: bg, color, border: `1px solid ${border}`, fontWeight: 800, fontSize: "0.8rem", mb: 0.5 }}
        />
        <Typography sx={{ fontSize: 11, color: "#999", lineHeight: 1.4 }}>
          评分为参考，不承诺播放效果
        </Typography>
      </Box>
    </Box>
  );
}

function DimBar({ label, score, analysis }: { label: string; score: number; analysis: string }) {
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#f59e0b" : "#dc2626";
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.4 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#555" }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 800, color }}>{score}</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{
          height: 5, borderRadius: 2.5, bgcolor: "#f5f5f5", mb: 0.6,
          "& .MuiLinearProgress-bar": {
            borderRadius: 2.5,
            bgcolor: color,
          },
        }}
      />
      <Typography sx={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>{analysis}</Typography>
    </Box>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { icon: string; color: string; bg: string; border: string }> = {
    "重拍":    { icon: "🎬", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    "继续发":  { icon: "🚀", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    "改标题":  { icon: "✏️", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
    "改剪辑":  { icon: "✂️", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    "换口吻":  { icon: "🗣️", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    "调整选题":{ icon: "💡", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  };
  const style = map[action] || { icon: "💬", color: "#555", bg: "#f9f9f9", border: "#eee" };
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", gap: 1,
      bgcolor: style.bg, border: `1.5px solid ${style.border}`,
      borderRadius: "10px", px: 2, py: 1,
    }}>
      <Typography sx={{ fontSize: 20 }}>{style.icon}</Typography>
      <Box>
        <Typography sx={{ fontSize: 11, color: "#999", fontWeight: 600 }}>AI 建议操作</Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 900, color: style.color }}>{action}</Typography>
      </Box>
    </Box>
  );
}

export default function VideoAnalysis() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<"analyzing" | "done" | "error">("analyzing");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FullAnalysisResult | null>(null);

  // SSE tracking states
  const [stages, setStages] = useState<ProgressStage[]>(
    Object.entries(STAGE_CONFIG).map(([key, val]) => ({
      key,
      label: val.label,
      status: "pending",
    }))
  );
  const [progress, setProgress] = useState(0);
  const [sseMessage, setSseMessage] = useState("准备启动分析任务...");
  const [tipIdx, setTipIdx] = useState(0);

  // Rotate tips while analyzing
  useEffect(() => {
    if (status !== "analyzing") return;
    const timer = setInterval(() => {
      setTipIdx((i) => (i + 1) % SSE_TIPS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [status]);

  // Expandable timeline segments
  const [expandedSegments, setExpandedSegments] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play().catch(() => {});
      videoRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const loadResult = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getVideoAnalysisResults(taskId);
      setResult(data);
      setStatus("done");
    } catch {
      setError("获取拉片结果失败，文件可能不存在或已损坏");
      setStatus("error");
    }
  }, [taskId]);

  // Handle SSE progress stream
  useEffect(() => {
    if (!taskId || status !== "analyzing") return;

    getVideoAnalysisResults(taskId)
      .then((data) => {
        setResult(data);
        setStatus("done");
      })
      .catch(() => {
        const es = new EventSource(`/api/video/analyze/${taskId}/stream`);

        const handleProgress = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            const { stage, progress: p, message: msg } = data;
            if (p != null) setProgress(p);
            if (msg) setSseMessage(msg);
            if (stage) {
              setStages((prev) =>
                prev.map((s) => ({
                  ...s,
                  status:
                    s.key === stage
                      ? "in_progress"
                      : s.status === "in_progress" && s.key !== stage
                      ? "complete"
                      : s.status,
                }))
              );
            }
          } catch (err) {
            console.error(err);
          }
        };

        const handleStageComplete = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            const { stage } = data;
            if (stage) {
              setStages((prev) =>
                prev.map((s) => (s.key === stage ? { ...s, status: "complete" } : s))
              );
            }
          } catch (err) {
            console.error(err);
          }
        };

        const handleDone = () => {
          setProgress(1.0);
          setStages((prev) => prev.map((s) => ({ ...s, status: "complete" })));
          es.close();
          void loadResult();
        };

        const handleError = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            setError(data.error || "大模型拉片超时或网络抖动");
            setStatus("error");
          } catch {
            setError("流水线处理时遇到非预期错误");
            setStatus("error");
          }
          es.close();
        };

        es.addEventListener("progress", handleProgress);
        es.addEventListener("stage_complete", handleStageComplete);
        es.addEventListener("done", handleDone);
        es.addEventListener("error", handleError);

        es.onerror = () => {};

        return () => {
          es.close();
        };
      });
  }, [taskId, status, loadResult]);

  const toggleSegment = (idx: number) => {
    setExpandedSegments((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ── RENDER 1: SSE Loading Progress ──
  if (status === "analyzing") {
    const currentStage = stages.find((s) => s.status === "in_progress");
    const stageTip = currentStage ? STAGE_CONFIG[currentStage.key]?.tip : "";
    return (
      <Box sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff5f6 0%, #fff9f0 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        p: 3,
      }}>
        <Card sx={{ width: "100%", maxWidth: 520, borderRadius: "24px", boxShadow: "0 20px 60px rgba(255,36,66,0.08)" }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#262626", mb: 0.5 }}>
              🎬 AI 内容诊断进行中
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#999", mb: 3 }}>
              正在深度分析视频，请勿关闭页面
            </Typography>

            <List sx={{ textAlign: "left", mb: 3 }}>
              {stages.map((stage) => (
                <ListItem key={stage.key} sx={{ py: 0.8, px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 34 }}>
                    {stage.status === "complete" && <CheckCircleIcon sx={{ color: "#16a34a", fontSize: 20 }} />}
                    {stage.status === "in_progress" && <CircularProgress size={18} sx={{ color: "#ff2442" }} />}
                    {stage.status === "pending" && <HourglassEmptyIcon sx={{ color: "#ddd", fontSize: 20 }} />}
                    {stage.status === "error" && <ErrorIcon sx={{ color: "#dc2626", fontSize: 20 }} />}
                  </ListItemIcon>
                  <Box>
                    <Typography sx={{
                      fontSize: 13,
                      fontWeight: stage.status === "in_progress" ? 700 : 500,
                      color:
                        stage.status === "complete" ? "#262626"
                        : stage.status === "in_progress" ? "#ff2442"
                        : "#bbb",
                    }}>
                      {stage.label}
                    </Typography>
                    {stage.status === "in_progress" && stageTip && (
                      <Typography sx={{ fontSize: 11, color: "#999", mt: 0.2 }}>{stageTip}</Typography>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>

            <Box sx={{ width: "100%", mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progress * 100}
                sx={{
                  height: 7, borderRadius: 3.5, bgcolor: "#f0f0f0",
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 3.5,
                    background: "linear-gradient(90deg, #ff8fa3, #ff2442)",
                  },
                }}
              />
              <Typography sx={{ fontSize: 11, color: "#bbb", mt: 0.8, textAlign: "right" }}>
                {Math.round(progress * 100)}%
              </Typography>
            </Box>

            {/* Rotating tips */}
            <Box sx={{
              bgcolor: "rgba(255,36,66,0.03)", border: "1px solid rgba(255,36,66,0.08)",
              borderRadius: "10px", px: 2, py: 1.5, mb: 2,
            }}>
              <Typography sx={{ fontSize: 12, color: "#ff2442", fontWeight: 600, lineHeight: 1.5 }}>
                {SSE_TIPS[tipIdx]}
              </Typography>
            </Box>

            <Typography sx={{ fontSize: 12, color: "#aaa" }}>{sseMessage}</Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // ── RENDER 2: Error Page ──
  if (status === "error") {
    return (
      <Box sx={{
        minHeight: "100vh", bgcolor: "#faf9f7",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        p: 3,
      }}>
        <Box sx={{ textAlign: "center", maxWidth: 400 }}>
          <ErrorIcon sx={{ fontSize: 64, color: "#dc2626", mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: "#262626", mb: 1 }}>分析失败</Typography>
          <Typography sx={{ fontSize: 13, color: "#888", mb: 4 }}>
            {error || "大模型分析异常，请重试"}
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/app")}
            sx={{ px: 4, py: 1.2, borderRadius: "10px", fontWeight: 700, background: "#ff2442", "&:hover": { background: "#e61e3d" } }}
          >
            返回首页
          </Button>
        </Box>
      </Box>
    );
  }

  if (!result) return null;

  const va = result.viral_analysis;

  // ── RENDER 3: Full Report ──
  return (
    <Box sx={{ bgcolor: "#faf9f7", minHeight: "100vh", pb: 8 }}>
      {/* Header */}
      <Box sx={{
        bgcolor: "#fff", borderBottom: "1px solid #f0f0f0", height: 48,
        display: "flex", alignItems: "center", px: { xs: 2, md: 4 },
        position: "sticky", top: 0, zIndex: 10,
        gap: 2,
      }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/app")}
          sx={{ color: "#666", fontWeight: 700, fontSize: "0.85rem", textTransform: "none", "&:hover": { color: "#ff2442" } }}
        >
          返回首页
        </Button>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#262626" }}>视频诊断报告</Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={va.service_notice} arrow>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "help" }}>
            <InfoOutlinedIcon sx={{ fontSize: 15, color: "#ccc" }} />
            <Typography sx={{ fontSize: 11, color: "#ccc" }}>单次诊断服务</Typography>
          </Box>
        </Tooltip>
      </Box>

      <Box sx={{ maxWidth: 1060, mx: "auto", px: { xs: 2, md: 3 }, pt: 3 }}>
        {/* ── Section 1: 视频 + 基础数据 ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3, mb: 3 }}>
          {/* Left: Video Player */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Card sx={{ borderRadius: "16px", overflow: "hidden", bgcolor: "#000", boxShadow: "0 8px 30px rgba(0,0,0,0.1)" }}>
              <video
                ref={videoRef}
                src={getVideoStreamUrl(result.task_id)}
                controls
                playsInline
                style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "contain" }}
              />
            </Card>

            {/* Meta Statistics */}
            <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#262626", mb: 0.5, fontSize: "1rem", lineHeight: 1.4 }}>
                  {result.video_meta.title || "（视频未设置标题）"}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#aaa", mb: 2 }}>
                  @{result.video_meta.author || "未知创作者"} · 时长 {result.video_meta.duration.toFixed(1)} 秒
                </Typography>

                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                  {result.video_meta.publish_time && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                      <CalendarTodayIcon sx={{ fontSize: 15, color: "#aaa" }} />
                      <Typography sx={{ fontSize: 12, color: "#888" }}>
                        {formatPublishTime(result.video_meta.publish_time)}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <FavoriteIcon sx={{ fontSize: 17, color: "#ff2442" }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#555" }}>
                      {formatCount(result.video_meta.likes)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <ChatBubbleIcon sx={{ fontSize: 17, color: "#888" }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#555" }}>
                      {formatCount(result.video_meta.comments)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                    <ShareIcon sx={{ fontSize: 17, color: "#888" }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#555" }}>
                      {formatCount(result.video_meta.shares)}
                    </Typography>
                  </Box>
                </Box>

                {/* Data Insight */}
                {va.data_insight && (
                  <Box sx={{
                    mt: 2, bgcolor: "#f9f9fa", borderRadius: "10px",
                    px: 1.5, py: 1.2, border: "1px solid #f0f0f0",
                  }}>
                    <Typography sx={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                      📊 {va.data_insight}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* 完整口播文案 (原版) */}
            <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <AccessTimeIcon sx={{ color: "#ff2442", fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 800, color: "#262626", fontSize: "0.95rem" }}>
                    原版口播文案
                  </Typography>
                </Box>
                {result.transcript.length === 0 ? (
                  <Typography sx={{ fontSize: 13, color: "#aaa", py: 2 }}>未检测到语音内容</Typography>
                ) : (
                  <Box sx={{ maxHeight: 200, overflowY: "auto", pr: 1 }}>
                    {result.transcript.map((seg, i) => (
                      <Box
                        key={i}
                        onClick={() => handleSeek(seg.start)}
                        sx={{
                          display: "flex", alignItems: "flex-start", gap: 1.5, py: 0.8, px: 1,
                          borderRadius: "8px", cursor: "pointer", transition: "all 0.2s", mb: 0.4,
                          "&:hover": { bgcolor: "rgba(255,36,66,0.04)" },
                        }}
                      >
                        <Typography sx={{ fontSize: 11, fontFamily: "monospace", color: "#ff5c72", mt: 0.2, flexShrink: 0 }}>
                          [{formatTime(seg.start)}]
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#444", lineHeight: 1.6 }}>
                          {seg.text}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>

          {/* Right: 综合诊断 */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* 爆款潜力评分 */}
            <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <WhatshotIcon sx={{ color: "#ff2442", fontSize: 22 }} />
                  <Typography sx={{ fontWeight: 800, color: "#262626", fontSize: "1.05rem" }}>
                    爆款潜力诊断
                  </Typography>
                </Box>

                {/* Score */}
                <ScoreBadge score={va.viral_score} level={va.viral_level} />

                <Divider sx={{ my: 2 }} />

                {/* Action Suggestion */}
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#999", mb: 1 }}>
                    AI 操作建议
                  </Typography>
                  <ActionBadge action={va.action_suggestion || "继续发"} />
                  {va.action_reason && (
                    <Typography sx={{ fontSize: 12, color: "#888", mt: 1, lineHeight: 1.5 }}>
                      {va.action_reason}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* 六维分析 */}
            <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontWeight: 800, color: "#262626", fontSize: "0.95rem", mb: 2 }}>
                  📐 六维问题分析
                </Typography>
                {va.dim_hook && <DimBar label="开头钩子" score={va.dim_hook.score} analysis={va.dim_hook.analysis} />}
                {va.dim_pacing && <DimBar label="内容节奏" score={va.dim_pacing.score} analysis={va.dim_pacing.analysis} />}
                {va.dim_emotion && <DimBar label="情绪强度" score={va.dim_emotion.score} analysis={va.dim_emotion.analysis} />}
                {va.dim_comment_bait && <DimBar label="评论驱动力" score={va.dim_comment_bait.score} analysis={va.dim_comment_bait.analysis} />}
                {va.dim_share_bait && <DimBar label="转发驱动力" score={va.dim_share_bait.score} analysis={va.dim_share_bait.analysis} />}
                {va.dim_cover_title && <DimBar label="标题封面" score={va.dim_cover_title.score} analysis={va.dim_cover_title.analysis} />}
              </CardContent>
            </Card>

            {/* 核心爆点 */}
            {va.key_viral_factors.length > 0 && (
              <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none" }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666", mb: 1.5 }}>
                    ⚡ 核心爆点因素
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {va.key_viral_factors.map((factor, i) => (
                      <Chip
                        key={i}
                        label={factor}
                        size="small"
                        sx={{
                          bgcolor: "rgba(255,36,66,0.04)", color: "#ff2442",
                          fontWeight: 700, fontSize: "0.75rem", height: 26,
                          border: "1px solid rgba(255,36,66,0.15)",
                        }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* 爆款密码 */}
            <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666", mb: 1.5 }}>
                  🧬 爆款底层公式
                </Typography>
                <Box sx={{ bgcolor: "#fffbeb", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", px: 2, py: 1.5, mb: 2 }}>
                  <Typography sx={{ fontSize: 13, color: "#92400e", fontWeight: 700, lineHeight: 1.5 }}>
                    {va.content_formula}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666", mb: 0.5 }}>受众情绪曲线</Typography>
                <Typography sx={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>{va.emotional_arc}</Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* ── Section 2: 本次视频优化建议 ── */}
        <Card sx={{ borderRadius: "16px", border: "1px solid rgba(255,36,66,0.15)", boxShadow: "0 4px 20px rgba(255,36,66,0.05)", mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
              <TipsAndUpdatesIcon sx={{ color: "#ff2442", fontSize: 22 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#262626", fontSize: "1rem" }}>
                本次视频优化建议
              </Typography>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
              {/* 建议新标题 */}
              {va.new_title && (
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#999", mb: 1 }}>💬 建议新标题</Typography>
                  <Box sx={{
                    bgcolor: "#fff", border: "1px solid #f0f0f0", borderRadius: "10px",
                    p: 2, position: "relative",
                  }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#262626", lineHeight: 1.5, pr: 4 }}>
                      {va.new_title}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => copyToClipboard(va.new_title, "new_title")}
                      sx={{ position: "absolute", top: 8, right: 8, color: copiedKey === "new_title" ? "#16a34a" : "#ccc" }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              )}

              {/* 前3秒开头 */}
              {va.opening_3s && (
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#999", mb: 1 }}>🎬 前3秒开头脚本</Typography>
                  <Box sx={{
                    bgcolor: "#fff", border: "1px solid #f0f0f0", borderRadius: "10px",
                    p: 2, position: "relative",
                  }}>
                    <Typography sx={{ fontSize: 13, color: "#444", lineHeight: 1.6, pr: 4 }}>
                      {va.opening_3s}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => copyToClipboard(va.opening_3s, "opening_3s")}
                      sx={{ position: "absolute", top: 8, right: 8, color: copiedKey === "opening_3s" ? "#16a34a" : "#ccc" }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              )}

              {/* 完整口播文案 */}
              {va.full_script && (
                <Box sx={{ gridColumn: { md: "1 / -1" } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#999" }}>✍️ 完整优化口播文案</Typography>
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
                      onClick={() => copyToClipboard(va.full_script, "full_script")}
                      sx={{
                        fontSize: 12, textTransform: "none",
                        color: copiedKey === "full_script" ? "#16a34a" : "#ff2442",
                        py: 0.3,
                      }}
                    >
                      {copiedKey === "full_script" ? "已复制" : "复制文案"}
                    </Button>
                  </Box>
                  <Box sx={{
                    bgcolor: "#fff", border: "1px solid #f0f0f0", borderRadius: "10px",
                    p: 2.5, maxHeight: 280, overflowY: "auto",
                  }}>
                    <Typography sx={{ fontSize: 13, color: "#333", lineHeight: 1.8, whiteSpace: "pre-line" }}>
                      {va.full_script}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* 评论区引导语 */}
              {va.comment_guide && (
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#999", mb: 1 }}>💬 评论区引导语（置顶评论）</Typography>
                  <Box sx={{
                    bgcolor: "#fff", border: "1px solid #f0f0f0", borderRadius: "10px",
                    p: 2, position: "relative",
                  }}>
                    <Typography sx={{ fontSize: 13, color: "#444", lineHeight: 1.6, pr: 4 }}>
                      {va.comment_guide}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => copyToClipboard(va.comment_guide, "comment_guide")}
                      sx={{ position: "absolute", top: 8, right: 8, color: copiedKey === "comment_guide" ? "#16a34a" : "#ccc" }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </Box>

            {/* 服务声明 */}
            <Box sx={{
              mt: 3, display: "flex", alignItems: "center", gap: 1,
              bgcolor: "#f9f9fa", borderRadius: "8px", px: 2, py: 1.2,
              border: "1px solid #f0f0f0",
            }}>
              <InfoOutlinedIcon sx={{ fontSize: 14, color: "#ccc", flexShrink: 0 }} />
              <Typography sx={{ fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
                {va.service_notice}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* ── Section 3: 复刻蓝图 ── */}
        {va.recreation_blueprint && (
          <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none", mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666", mb: 1.5 }}>
                🗺️ 拍摄复刻指南
              </Typography>
              <Box sx={{
                bgcolor: "#f9f9fa", borderRadius: "10px", p: 2.5,
                fontSize: 13, color: "#555", lineHeight: 1.8,
                whiteSpace: "pre-line", border: "1px solid #f0f0f0",
              }}>
                {va.recreation_blueprint}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* ── Section 4: 逐段时间线 ── */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: "#262626", mb: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
            🎬 逐段画面拆解 · AI 创作提示词
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {result.segments.map((seg, idx) => {
              const isExpanded = !!expandedSegments[idx];
              const firstFrame = seg.frames[0];

              return (
                <Card
                  key={idx}
                  sx={{
                    borderRadius: "14px", border: "1px solid #f0f0f0", boxShadow: "none",
                    overflow: "hidden", transition: "all 0.2s",
                    "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.03)", borderColor: "rgba(255,36,66,0.12)" },
                  }}
                >
                  {/* Collapsed header */}
                  <Box
                    onClick={() => toggleSegment(idx)}
                    sx={{ display: "flex", gap: { xs: 2, sm: 3 }, p: 2, cursor: "pointer", alignItems: "flex-start" }}
                  >
                    {firstFrame?.frame_path && (
                      <Box
                        onClick={(e) => { e.stopPropagation(); handleSeek(seg.start_time); }}
                        sx={{
                          position: "relative", width: 110, height: 75,
                          borderRadius: "8px", overflow: "hidden", flexShrink: 0,
                          cursor: "pointer", border: "1px solid #eee",
                          "&:hover .play-overlay": { opacity: 1 },
                        }}
                      >
                        <img
                          src={getFrameImageUrl(result.task_id, firstFrame.frame_path)}
                          alt={`第 ${seg.start_time} 秒`}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <Box
                          className="play-overlay"
                          sx={{
                            position: "absolute", inset: 0,
                            bgcolor: "rgba(0,0,0,0.3)", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            opacity: 0, transition: "opacity 0.2s",
                          }}
                        >
                          <PlayArrowIcon sx={{ color: "#fff" }} />
                        </Box>
                      </Box>
                    )}

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <Chip
                          label={`${formatTime(seg.start_time)} - ${formatTime(seg.end_time)}`}
                          size="small"
                          sx={{ bgcolor: "rgba(255,36,66,0.04)", color: "#ff2442", fontWeight: 700, fontSize: "0.75rem", borderRadius: "4px" }}
                        />
                        <Typography sx={{ fontSize: 11, color: "#ccc", fontWeight: 600 }}>片段 #{idx + 1}</Typography>
                      </Box>

                      {firstFrame && (
                        <Box sx={{ display: "flex", gap: 2, mb: 1.5 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 11, color: "#999" }}>景别</Typography>
                            <Typography sx={{ fontSize: 12, color: "#333", fontWeight: 600 }}>{firstFrame.shot_type || "-"}</Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 11, color: "#999" }}>运镜</Typography>
                            <Typography sx={{ fontSize: 12, color: "#333", fontWeight: 600 }}>{firstFrame.camera_movement || "-"}</Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 11, color: "#999" }}>情绪</Typography>
                            <Typography sx={{ fontSize: 12, color: "#333", fontWeight: 600 }}>{firstFrame.mood || "-"}</Typography>
                          </Box>
                        </Box>
                      )}

                      {seg.transcript && (
                        <Typography sx={{ fontSize: 12, color: "#666", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                          💬 {seg.transcript}
                        </Typography>
                      )}
                    </Box>

                    <IconButton size="small" sx={{ alignSelf: "center", color: "#ccc", flexShrink: 0 }}>
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <Box sx={{ borderTop: "1px solid #f5f5f5", px: { xs: 2, sm: 3 }, pb: 3, pt: 1 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#999", mt: 1.5, mb: 1.5 }}>画面逐帧拆解</Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {seg.frames.map((frame, fi) => (
                          <Box
                            key={fi}
                            sx={{ p: 1.5, borderRadius: "10px", bgcolor: "#f9f9fa", borderLeft: "3px solid #ff2442" }}
                          >
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                              <Typography sx={{ fontSize: 11, fontFamily: "monospace", color: "#ff5c72", fontWeight: 700 }}>
                                时间标戳: {formatTime(frame.timestamp)}
                              </Typography>
                              <Button
                                size="small"
                                startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
                                onClick={() => handleSeek(frame.timestamp)}
                                sx={{ color: "#ff2442", fontSize: 11, textTransform: "none", py: 0 }}
                              >
                                定位画面
                              </Button>
                            </Box>
                            <Typography sx={{ fontSize: 13, color: "#333", mb: 1.5, lineHeight: 1.5 }}>
                              {frame.visual_description}
                            </Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                              <Chip label={`景别: ${frame.shot_type || "无"}`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: "#fff", border: "1px solid #eee" }} />
                              <Chip label={`运镜: ${frame.camera_movement || "无"}`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: "#fff", border: "1px solid #eee" }} />
                              <Chip label={`构图: ${frame.composition || "无"}`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: "#fff", border: "1px solid #eee" }} />
                              {frame.transition && frame.transition !== "无" && (
                                <Chip label={`转场: ${frame.transition}`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: "#f5f0ff", color: "#6b21a8", border: "1px solid #e9d5ff" }} />
                              )}
                              {frame.text_overlay && (
                                <Chip label={`文字: ${frame.text_overlay}`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: "#fffbeb", color: "#92400e", border: "1px solid #fef3c7" }} />
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>

                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#999", mt: 3, mb: 1.5 }}>
                        AI 复刻创作提示词
                      </Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {[
                          { key: "visual" as const, label: "📸 画面提示词 (用于 AI 生图/生视频)", text: seg.ai_prompts.visual },
                          { key: "copywriting" as const, label: "✍️ 文案脚本提示词 (用于 AI 文案重写)", text: seg.ai_prompts.copywriting },
                          { key: "recreation" as const, label: "🎬 导演拍摄提示词 (用于拍摄运镜执行)", text: seg.ai_prompts.recreation },
                        ].map((promptItem) => {
                          if (!promptItem.text) return null;
                          const ckey = `${idx}_${promptItem.key}`;
                          const isCopied = copiedKey === ckey;
                          return (
                            <Box
                              key={promptItem.key}
                              sx={{ p: 2, borderRadius: "10px", bgcolor: "#fcfcff", border: "1px solid rgba(0,0,0,0.04)" }}
                            >
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#666" }}>
                                  {promptItem.label}
                                </Typography>
                                <Button
                                  size="small"
                                  startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
                                  onClick={() => copyToClipboard(promptItem.text, ckey)}
                                  sx={{ fontSize: 11, textTransform: "none", color: isCopied ? "#16a34a" : "#ff2442", py: 0.2, borderRadius: "4px" }}
                                >
                                  {isCopied ? "已复制" : "复制"}
                                </Button>
                              </Box>
                              <Typography sx={{ fontSize: 13, color: "#444", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                                {promptItem.text}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                </Card>
              );
            })}
          </Box>
          <ContactFeedback
            resultId={result.task_id}
            resultType="video"
            reportTitle={result.video_meta.title}
            reportJson={result}
          />
        </Box>
      </Box>
    </Box>
  );
}
