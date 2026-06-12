import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tab,
  Tabs,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { motion } from "framer-motion";
import type { HistoryListItem } from "../utils/api";
import {
  getHistoryList,
  getHistoryDetail,
  deleteHistory,
  getVideoHistoryList,
  deleteVideoHistory,
} from "../utils/api";
import {
  migrateLegacyLocalStorage,
  listLocalDiagnoses,
  getLocalDiagnosis,
  deleteLocalDiagnosis,
  localRecordToListItem,
} from "../utils/localMemory";

const CATEGORY_LABEL: Record<string, string> = {
  food: "美食",
  fashion: "时尚",
  tech: "科技",
  travel: "旅行",
  beauty: "美妆",
  fitness: "健身",
  lifestyle: "生活",
  home: "家居",
  video: "视频",
};

const GRADE_COLOR: Record<string, string> = {
  S: "#ea580c",
  A: "#16a34a",
  B: "#2563eb",
  C: "#d97706",
  D: "#dc2626",
  "高": "#16a34a",
  "中": "#2563eb",
  "低": "#dc2626",
};

/** 按创建时间倒序 */
function sortListItems(a: HistoryListItem, b: HistoryListItem): number {
  const ta = new Date(
    a.created_at.includes("T") ? a.created_at : a.created_at.replace(" ", "T"),
  ).getTime();
  const tb = new Date(
    b.created_at.includes("T") ? b.created_at : b.created_at.replace(" ", "T"),
  ).getTime();
  return tb - ta;
}

export default function History() {
  const navigate = useNavigate();
  const token = localStorage.getItem("noterx_token");
  const isLoggedIn = !!token;

  // Tabs: 0 = Cloud Note, 1 = Cloud Video, 2 = Local Note
  const [currentTab, setCurrentTab] = useState<number>(isLoggedIn ? 0 : 2);
  const [items, setItems] = useState<HistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HistoryListItem | null>(null);

  const fetchList = async () => {
    setLoading(true);
    setItems([]);
    try {
      if (currentTab === 2) {
        // Load from Local IndexedDB
        await migrateLegacyLocalStorage();
        const locals = await listLocalDiagnoses();
        setItems(locals.map(localRecordToListItem).sort(sortListItems));
      } else if (currentTab === 0) {
        // Load Cloud Note Diagnoses from MySQL
        if (isLoggedIn) {
          const cloudNotes = await getHistoryList(50, 0);
          setItems(cloudNotes);
        }
      } else if (currentTab === 1) {
        // Load Cloud Video Analyses from MySQL
        if (isLoggedIn) {
          const cloudVideos = await getVideoHistoryList(50, 0);
          setItems(cloudVideos);
        }
      }
    } catch (e) {
      console.error("读取历史列表失败", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [currentTab]);

  /** 点击卡片：跳转详情或加载详情后跳转 */
  const handleOpen = async (item: HistoryListItem) => {
    setNavigating(item.id);
    try {
      if (currentTab === 2) {
        // Local note diagnosis
        const rec = await getLocalDiagnosis(item.id);
        if (!rec) throw new Error("本地记录不存在");
        const p = rec.params;
        navigate("/report", {
          state: {
            id: rec.id,
            report: rec.report,
            params: {
              title: typeof p.title === "string" ? p.title : rec.title,
              category: typeof p.category === "string" ? p.category : rec.category,
              content: typeof p.content === "string" ? p.content : undefined,
              tags: p.tags,
            },
            isFallback: false,
          },
        });
      } else if (currentTab === 0) {
        // Cloud note diagnosis
        const res = await getHistoryDetail(item.id);
        navigate("/report", {
          state: {
            id: res.id,
            report: res.report,
            params: { title: res.title, category: res.category, content: res.report.optimized_content },
            isFallback: false,
          },
        });
      } else if (currentTab === 1) {
        // Cloud video analysis
        navigate(`/video-analysis/${item.id}`);
      }
    } catch (e) {
      console.error("打开历史记录失败", e);
    } finally {
      setNavigating(null);
    }
  };

  /** 确认删除 */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const id = deleteTarget.id;
      if (currentTab === 2) {
        await deleteLocalDiagnosis(id);
      } else if (currentTab === 0) {
        await deleteHistory(id);
      } else if (currentTab === 1) {
        await deleteVideoHistory(id);
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      console.error("删除失败", e);
    }
    setDeleteTarget(null);
  };

  const formatTime = (ts: string) => {
    if (!ts) return "";
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fafafa" }}>
      {/* 顶栏 */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "#fff",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Box
          sx={{
            maxWidth: 640,
            mx: "auto",
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/app")}
            size="small"
            sx={{
              color: "#666",
              fontWeight: 700,
              fontSize: 13,
              borderRadius: "8px",
              "&:hover": { color: "#ff2442", bgcolor: "#fff0f2" }
            }}
          >
            首页
          </Button>
          <Box sx={{ textAlign: "center" }}>
            <Typography sx={{ fontWeight: 800, color: "#262626", fontSize: 16 }}>
              诊断历史
            </Typography>
          </Box>
          <Box sx={{ width: 64 }} />
        </Box>
      </Box>

      {/* Tabs 切换器 */}
      <Box
        sx={{
          maxWidth: 640,
          mx: "auto",
          bgcolor: "#fff",
          borderBottom: "1px solid #e2e2e2",
          px: 1,
        }}
      >
        <Tabs
          value={currentTab}
          onChange={(_, val) => setCurrentTab(val)}
          variant="fullWidth"
          sx={{
            minHeight: 44,
            "& .MuiTabs-indicator": {
              bgcolor: "#ff2442",
              height: 3,
              borderRadius: 1.5,
            },
            "& .MuiTab-root": {
              textTransform: "none",
              fontSize: 13,
              fontWeight: 800,
              color: "#888",
              "&.Mui-selected": {
                color: "#ff2442",
              },
            },
          }}
        >
          <Tab label="图文诊断 (云端)" />
          <Tab label="视频拉片 (云端)" />
          <Tab label="本地记录 (离线)" />
        </Tabs>
      </Box>

      <Box sx={{ maxWidth: 640, mx: "auto", px: 2, mt: 3, pb: 10 }}>
        {(currentTab === 0 || currentTab === 1) && !isLoggedIn ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Box sx={{ textAlign: "center", py: 10 }}>
              <InboxOutlinedIcon sx={{ fontSize: 56, color: "#ccc" }} />
              <Typography sx={{ mt: 1.5, color: "#666", fontSize: 13, px: 3, lineHeight: 1.7 }}>
                您当前尚未登录账号。<br />登录后即可将诊断历史同步存储在云端，并支持短视频拉片分析历史的查看与管理。
              </Typography>
              <Button
                variant="contained"
                disableElevation
                sx={{
                  mt: 3,
                  bgcolor: "#ff2442",
                  borderRadius: "20px",
                  fontWeight: 800,
                  px: 4,
                  textTransform: "none",
                  "&:hover": { bgcolor: "#cc1a35" },
                }}
                onClick={() => navigate("/app")}
              >
                前往登录
              </Button>
            </Box>
          </motion.div>
        ) : loading ? (
          <Box sx={{ textAlign: "center", py: 10 }}>
            <CircularProgress size={28} sx={{ color: "#ff2442" }} />
            <Typography sx={{ mt: 2, color: "#999", fontSize: 13 }}>
              加载历史记录中...
            </Typography>
          </Box>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Box sx={{ textAlign: "center", py: 10 }}>
              <InboxOutlinedIcon sx={{ fontSize: 56, color: "#ccc" }} />
              <Typography sx={{ mt: 1.5, color: "#999", fontSize: 13 }}>
                暂无分析诊断记录
              </Typography>
              <Button
                variant="contained"
                disableElevation
                sx={{
                  mt: 3,
                  bgcolor: "#ff2442",
                  borderRadius: "20px",
                  fontWeight: 700,
                  textTransform: "none",
                  px: 4,
                  "&:hover": { bgcolor: "#cc1a35" },
                }}
                onClick={() => navigate("/app")}
              >
                去诊断分析
              </Button>
            </Box>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {items.map((item) => {
                const gradeColor = GRADE_COLOR[item.grade] || "#ff2442";
                const displayScore = currentTab === 1
                  ? item.overall_score  // 视频评分已是整数
                  : Math.round(item.overall_score);
                
                return (
                  <Box
                    key={item.id}
                    onClick={() => !navigating && handleOpen(item)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 2,
                      py: 1.5,
                      bgcolor: "#fff",
                      border: "1px solid #e8e8e8",
                      borderRadius: "16px",
                      cursor: navigating === item.id ? "wait" : "pointer",
                      transition: "all 0.2s ease",
                      "&:hover": { borderColor: "#ff2442", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" },
                    }}
                  >
                    {/* 分数 */}
                    <Box sx={{ textAlign: "center", flexShrink: 0, minWidth: 44 }}>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: 22,
                          lineHeight: 1,
                          color: gradeColor,
                        }}
                      >
                        {displayScore}
                      </Typography>
                      {item.grade && (
                        <Typography sx={{ fontSize: 9, fontWeight: 700, color: gradeColor, mt: 0.5 }}>
                          {item.grade}级
                        </Typography>
                      )}
                    </Box>

                    {/* 标题 + 标签 + 日期 */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#262626",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mt: 0.5,
                        }}
                      >
                        <Typography
                          component="span"
                          sx={{
                            fontSize: 10,
                            color: "#ff2442",
                            bgcolor: "#fff0f2",
                            borderRadius: "4px",
                            px: 0.75,
                            py: 0.1,
                            fontWeight: 700,
                            lineHeight: "18px",
                          }}
                        >
                          {CATEGORY_LABEL[item.category] || item.category}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: "#999" }}>
                          {formatTime(item.created_at)}
                        </Typography>
                      </Box>
                    </Box>

                    {navigating === item.id && (
                      <CircularProgress size={16} sx={{ color: "#ff2442" }} />
                    )}

                    {/* 删除按钮 */}
                    <IconButton
                      size="small"
                      sx={{
                        color: "#ccc",
                        flexShrink: 0,
                        "&:hover": { color: "#dc2626", bgcolor: "#fff0f2" },
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(item);
                      }}
                    >
                      <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          </motion.div>
        )}
      </Box>

      {/* 删除确认对话框 */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              maxWidth: 360,
              p: 1
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, color: "#262626" }}>
          删除记录
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13, color: "#666" }}>
            确定删除「{deleteTarget?.title}」的分析记录吗？此操作将彻底从服务器或本地空间移除，不可恢复。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteTarget(null)}
            sx={{ color: "#999", textTransform: "none", fontWeight: 700 }}
          >
            取消
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            disableElevation
            sx={{
              bgcolor: "#dc2626",
              textTransform: "none",
              borderRadius: "10px",
              fontWeight: 800,
              "&:hover": { bgcolor: "#b91c1c" },
            }}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

