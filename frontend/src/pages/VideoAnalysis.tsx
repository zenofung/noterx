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

import {
  getVideoAnalysisResults,
  getVideoStreamUrl,
  getFrameImageUrl,
} from "../utils/api";
import type {
  FullAnalysisResult,
  ProgressStage,
} from "../utils/api";

const STAGE_CONFIG: Record<string, string> = {
  downloading: "下载短视频",
  extracting: "提取音频与关键帧",
  transcribing: "语音识别中",
  analyzing_frames: "AI 画面视觉分析",
  generating_prompts: "生成创作提示词",
  viral_analysis: "整体爆款密码分析",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCount(n: number | null): string {
  if (n == null) return "-";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return n.toLocaleString();
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
    Object.entries(STAGE_CONFIG).map(([key, label]) => ({
      key,
      label,
      status: "pending",
    }))
  );
  const [progress, setProgress] = useState(0);
  const [sseMessage, setSseMessage] = useState("准备启动分析任务...");

  // Expandable timeline segments
  const [expandedSegments, setExpandedSegments] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play().catch(() => {});
      // Scroll to video container on mobile
      videoRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const loadResult = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getVideoAnalysisResults(taskId);
      setResult(data);
      setStatus("done");
    } catch (e: any) {
      setError("获取拉片结果失败，文件可能不存在或已损坏");
      setStatus("error");
    }
  }, [taskId]);

  // Handle SSE progress stream
  useEffect(() => {
    if (!taskId || status !== "analyzing") return;

    // Check if result already exists first (e.g. page refresh)
    getVideoAnalysisResults(taskId)
      .then((data) => {
        setResult(data);
        setStatus("done");
      })
      .catch(() => {
        // Not ready, connect to SSE stream
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

        es.onerror = () => {
          // SSE connection issue, but don't fail immediately unless status becomes error
        };

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
    return (
      <Box sx={{
        minHeight: "100vh", bgcolor: "#faf9f7",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        p: 3,
      }}>
        <Card sx={{ width: "100%", maxWidth: 500, borderRadius: "20px", boxShadow: "0 12px 40px rgba(0,0,0,0.04)" }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#262626", mb: 3 }}>
              🎬 AI 短视频拉片分析中
            </Typography>

            <List sx={{ textAlign: "left", mb: 4 }}>
              {stages.map((stage) => (
                <ListItem key={stage.key} sx={{ py: 1 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {stage.status === "complete" && <CheckCircleIcon sx={{ color: "#16a34a" }} />}
                    {stage.status === "in_progress" && <CircularProgress size={20} sx={{ color: "#ff2442" }} />}
                    {stage.status === "pending" && <HourglassEmptyIcon sx={{ color: "#ccc" }} />}
                    {stage.status === "error" && <ErrorIcon sx={{ color: "#dc2626" }} />}
                  </ListItemIcon>
                  <Typography sx={{
                    fontSize: 14,
                    fontWeight: stage.status === "in_progress" ? 700 : 500,
                    color:
                      stage.status === "complete"
                        ? "#262626"
                        : stage.status === "in_progress"
                        ? "#ff2442"
                        : "#999",
                  }}>
                    {stage.label}
                  </Typography>
                </ListItem>
              ))}
            </List>

            <Box sx={{ width: "100%", mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progress * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "#f0f0f0",
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 3,
                    background: "linear-gradient(90deg, #ff5c6f, #e61e3d)",
                  },
                }}
              />
            </Box>

            <Typography sx={{ fontSize: 13, color: "#666", fontWeight: 500 }}>
              {sseMessage}
            </Typography>
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
          <Typography variant="h6" sx={{ fontWeight: 800, color: "#262626", mb: 1 }}>
            分析失败
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#888", mb: 4 }}>
            {error || "大模型分析异常，请重试"}
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/app")}
            sx={{
              px: 4, py: 1.2, borderRadius: "10px", fontWeight: 700,
              background: "#ff2442",
              "&:hover": { background: "#e61e3d" },
            }}
          >
            返回首页
          </Button>
        </Box>
      </Box>
    );
  }

  if (!result) return null;

  // ── RENDER 3: Full Report Screen ──
  return (
    <Box sx={{ bgcolor: "#faf9f7", minHeight: "100vh", pb: 8 }}>
      {/* Top Header */}
      <Box sx={{
        bgcolor: "#fff", borderBottom: "1px solid #f0f0f0", height: 48,
        display: "flex", alignItems: "center", px: { xs: 2, md: 4 },
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/app")}
          sx={{
            color: "#666", fontWeight: 700, fontSize: "0.85rem",
            textTransform: "none",
            "&:hover": { color: "#ff2442" },
          }}
        >
          返回首页
        </Button>
        <Typography sx={{ ml: 2, fontSize: 14, fontWeight: 700, color: "#262626" }}>
          视频分析报告
        </Typography>
      </Box>

      {/* Main Container */}
      <Box sx={{ maxWidth: 1000, mx: "auto", px: { xs: 2, md: 3 }, pt: 3 }}>
        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 3,
        }}>
          {/* Left Column: Player & Meta */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Video Player */}
            <Card sx={{
              borderRadius: "16px", overflow: "hidden", bgcolor: "#000",
              boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
            }}>
              <video
                ref={videoRef}
                src={getVideoStreamUrl(result.task_id)}
                controls
                playsInline
                style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "contain" }}
              />
            </Card>

            {/* Video Meta Statistics */}
            <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#262626", mb: 1, fontSize: "1.05rem" }}>
                  {result.video_meta.title || "（视频未设置标题）"}
                </Typography>
                <Typography sx={{ fontSize: 13, color: "#888", mb: 2.5, fontWeight: 500 }}>
                  @{result.video_meta.author || "未知创作者"} · 时长 {result.video_meta.duration.toFixed(1)} 秒
                </Typography>

                <Box sx={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <FavoriteIcon sx={{ fontSize: 18, color: "#ff2442" }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#555" }}>
                      {formatCount(result.video_meta.likes)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ChatBubbleIcon sx={{ fontSize: 18, color: "#888" }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#555" }}>
                      {formatCount(result.video_meta.comments)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ShareIcon sx={{ fontSize: 18, color: "#888" }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#555" }}>
                      {formatCount(result.video_meta.shares)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* 完整口播文案 */}
            <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none" }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <AccessTimeIcon sx={{ color: "#ff2442", fontSize: 20 }} />
                  <Typography sx={{ fontWeight: 800, color: "#262626", fontSize: "0.95rem" }}>
                    完整口播文案
                  </Typography>
                </Box>

                {result.transcript.length === 0 ? (
                  <Typography sx={{ fontSize: 13, color: "#aaa", py: 2 }}>未检测到语音内容</Typography>
                ) : (
                  <Box sx={{ maxHeight: 220, overflowY: "auto", pr: 1 }}>
                    {result.transcript.map((seg, i) => (
                      <Box
                        key={i}
                        onClick={() => handleSeek(seg.start)}
                        sx={{
                          display: "flex", alignItems: "flex-start", gap: 1.5, py: 1, px: 1.2,
                          borderRadius: "8px", cursor: "pointer", transition: "all 0.2s",
                          mb: 0.5,
                          "&:hover": {
                            bgcolor: "rgba(255,36,66,0.04)",
                            "& .time-mark": { color: "#ff2442", fontWeight: 700 },
                          }
                        }}
                      >
                        <Typography
                          className="time-mark"
                          sx={{ fontSize: 11, fontFamily: "monospace", color: "#ff5c72", mt: 0.2, flexShrink: 0 }}
                        >
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

          {/* Right Column: Viral Analysis */}
          <Box>
            <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none", height: "100%" }}>
              <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <WhatshotIcon sx={{ color: "#ff2442", fontSize: 22 }} />
                  <Typography sx={{ fontWeight: 800, color: "#262626", fontSize: "1.05rem" }}>
                    🔥 爆款基因拆解
                  </Typography>
                </Box>

                {/* 开头钩子评分 */}
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666" }}>
                      黄金 3 秒开场钩子评分
                    </Typography>
                    <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#ff2442" }}>
                      {result.viral_analysis.hook_score}/100
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={result.viral_analysis.hook_score * 10}
                    sx={{
                      height: 5, borderRadius: 2.5, bgcolor: "#f5f5f5",
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 2.5,
                        background: "linear-gradient(90deg, #ff8fa3, #ff2442)",
                      }
                    }}
                  />
                  <Typography sx={{ fontSize: 13, color: "#666", mt: 1.5, lineHeight: 1.6 }}>
                    {result.viral_analysis.hook_analysis}
                  </Typography>
                </Box>

                {/* 爆点因素 */}
                {result.viral_analysis.key_viral_factors.length > 0 && (
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666", mb: 1 }}>
                      核心爆点因素
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {result.viral_analysis.key_viral_factors.map((factor, i) => (
                        <Chip
                          key={i}
                          label={factor}
                          size="small"
                          sx={{
                            bgcolor: "rgba(255,36,66,0.04)", color: "#ff2442",
                            fontWeight: 700, fontSize: "0.75rem", height: 24,
                            border: "1px solid rgba(255,36,66,0.15)",
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* 节奏分析 */}
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666", mb: 0.5 }}>
                    视频剪辑节奏
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                    {result.viral_analysis.pacing_analysis}
                  </Typography>
                </Box>

                {/* 情绪曲线 */}
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666", mb: 0.5 }}>
                    受众情绪起伏曲线
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                    {result.viral_analysis.emotional_arc}
                  </Typography>
                </Box>

                {/* 内容公式 */}
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666", mb: 1 }}>
                    爆款底层内容公式
                  </Typography>
                  <Box sx={{
                    bgcolor: "#fffbeb", border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: "10px", px: 2, py: 1.5,
                  }}>
                    <Typography sx={{ fontSize: 13, color: "#92400e", fontWeight: 700, lineHeight: 1.5 }}>
                      {result.viral_analysis.content_formula}
                    </Typography>
                  </Box>
                </Box>

                {/* 目标受众 */}
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666", mb: 0.5 }}>
                    精准目标受众
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                    {result.viral_analysis.target_audience}
                  </Typography>
                </Box>

                {/* 复刻蓝图 */}
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#666", mb: 1 }}>
                    拍摄复刻指南
                  </Typography>
                  <Box sx={{
                    bgcolor: "#f9f9fa", borderRadius: "10px", p: 2,
                    fontSize: 13, color: "#555", lineHeight: 1.7,
                    whiteSpace: "pre-line", border: "1px solid #f0f0f0",
                  }}>
                    {result.viral_analysis.recreation_blueprint}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* 逐秒分析 Timeline */}
        <Box sx={{ mt: 5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: "#262626", mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
            🎬 逐秒拆解与 AI 创作提示词
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
                    "&:hover": {
                      boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
                      borderColor: "rgba(255,36,66,0.15)",
                    }
                  }}
                >
                  {/* Collapsed view header */}
                  <Box
                    onClick={() => toggleSegment(idx)}
                    sx={{
                      display: "flex", gap: { xs: 2, sm: 3 }, p: 2, cursor: "pointer",
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Thumbnail */}
                    {firstFrame?.frame_path && (
                      <Box
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSeek(seg.start_time);
                        }}
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

                    {/* Middle summary */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <Chip
                          label={`${formatTime(seg.start_time)} - ${formatTime(seg.end_time)}`}
                          size="small"
                          sx={{
                            bgcolor: "rgba(255,36,66,0.04)", color: "#ff2442",
                            fontWeight: 700, fontSize: "0.75rem", borderRadius: "4px",
                          }}
                        />
                        <Typography sx={{ fontSize: 11, color: "#ccc", fontWeight: 600 }}>
                          片段 #{idx + 1}
                        </Typography>
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
                        <Typography sx={{ fontSize: 12, color: "#666", display: "flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                          💬 {seg.transcript}
                        </Typography>
                      )}
                    </Box>

                    {/* Expand Arrow */}
                    <IconButton size="small" sx={{ alignSelf: "center", color: "#ccc", flexShrink: 0 }}>
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <Box sx={{ borderTop: "1px solid #f5f5f5", px: { xs: 2, sm: 3 }, pb: 3, pt: 1 }}>
                      {/* Frames Analysis list */}
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#999", mt: 1.5, mb: 1.5 }}>
                        画面逐帧拆解
                      </Typography>

                      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {seg.frames.map((frame, fi) => (
                          <Box
                            key={fi}
                            sx={{
                              p: 1.5, borderRadius: "10px", bgcolor: "#f9f9fa",
                              borderLeft: "3px solid #ff2442",
                            }}
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

                            {frame.key_elements.length > 0 && (
                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1.5 }}>
                                {frame.key_elements.map((el, ei) => (
                                  <Typography key={ei} sx={{ fontSize: 11, color: "#999" }}>
                                    #{el}
                                  </Typography>
                                ))}
                              </Box>
                            )}
                          </Box>
                        ))}
                      </Box>

                      {/* AI Prompts */}
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#999", mt: 3, mb: 1.5 }}>
                        AI 复刻创作提示词
                      </Typography>

                      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {[
                          { key: "visual" as const, label: "📸 画面画面提示词 (用于 AI 生图/生视频)", text: seg.ai_prompts.visual },
                          { key: "copywriting" as const, label: "✍️ 文案脚本提示词 (用于 AI 文案重写)", text: seg.ai_prompts.copywriting },
                          { key: "recreation" as const, label: "🎬 导演拍摄提示词 (用于 拍摄运镜执行)", text: seg.ai_prompts.recreation },
                        ].map((promptItem) => {
                          if (!promptItem.text) return null;
                          const ckey = `${idx}_${promptItem.key}`;
                          const isCopied = copiedKey === ckey;

                          return (
                            <Box
                              key={promptItem.key}
                              sx={{
                                p: 2, borderRadius: "10px", bgcolor: "#fcfcff",
                                border: "1px solid rgba(0,0,0,0.04)",
                              }}
                            >
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#666" }}>
                                  {promptItem.label}
                                </Typography>
                                <Button
                                  size="small"
                                  startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
                                  onClick={() => copyToClipboard(promptItem.text, ckey)}
                                  sx={{
                                    fontSize: 11, textTransform: "none", color: isCopied ? "#16a34a" : "#ff2442",
                                    py: 0.2, borderRadius: "4px",
                                  }}
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
        </Box>
      </Box>
    </Box>
  );
}
