import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TablePagination,
  CircularProgress,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Chip,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { getVideoAnalyses } from "../utils/api";

interface VideoTaskItem {
  task_id: string;
  user_id: string | null;
  user_nickname: string;
  video_url: string;
  video_title: string;
  author_name: string;
  viral_score: number | null;
  viral_level: string | null;
  created_at: string;
  completed_at: string | null;
  report_json: any;
}

export default function VideoAnalyses() {
  const [items, setItems] = useState<VideoTaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState("");

  const [selectedItem, setSelectedItem] = useState<VideoTaskItem | null>(null);

  const fetchVideos = () => {
    setLoading(true);
    const limit = rowsPerPage;
    const offset = page * rowsPerPage;
    getVideoAnalyses(limit, offset, search)
      .then((res) => {
        if (res.success) {
          setItems(res.items);
          setTotal(res.total);
        }
      })
      .catch((err) => console.error("Error fetching video tasks:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchVideos();
  }, [page, rowsPerPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchVideos();
  };

  const getLevelColor = (level: string | null) => {
    if (level === "高") return "#16a34a";
    if (level === "中") return "#2563eb";
    return "#dc2626";
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#262626", mb: 0.5 }}>
            短视频拉片分析任务
          </Typography>
          <Typography variant="body2" sx={{ color: "#888" }}>
            监控异步短视频下载、ASR 台词音频解析与画面爆款潜力分析的任务列表及运行耗时。
          </Typography>
        </Box>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit}>
          <TextField
            size="small"
            placeholder="搜索视频标题/创作者..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "#999", fontSize: 18 }} />
                  </InputAdornment>
                ),
              }
            }}
            sx={{
              width: 260,
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                bgcolor: "#fff",
                "&:hover fieldset": { borderColor: "#ff2442" },
                "&.Mui-focused fieldset": { borderColor: "#ff2442" },
              },
            }}
          />
        </form>
      </Box>

      {/* Video tasks Table */}
      <TableContainer component={Paper} sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "none", overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
            <CircularProgress sx={{ color: "#ff2442" }} />
          </Box>
        ) : (
          <>
            <Table sx={{ minWidth: 650 }} size="medium">
              <TableHead sx={{ bgcolor: "#fafafa" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>任务状态</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>爆款指数</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>视频标题</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>创作者</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>发起账号</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>创建时间</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555", textAlign: "center" }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.task_id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell>
                      {row.completed_at ? (
                        <Chip label="已完成" size="small" sx={{ bgcolor: "#e6f4ea", color: "#137333", fontWeight: 700, fontSize: "0.75rem", borderRadius: "6px" }} />
                      ) : (
                        <Chip label="分析中..." size="small" sx={{ bgcolor: "#fef7e0", color: "#b06000", fontWeight: 700, fontSize: "0.75rem", borderRadius: "6px" }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {row.viral_score != null ? (
                        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
                          <Typography sx={{ fontWeight: 900, fontSize: "1.1rem", color: getLevelColor(row.viral_level) }}>
                            {row.viral_score}
                          </Typography>
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: getLevelColor(row.viral_level) }}>
                            ({row.viral_level}级)
                          </Typography>
                        </Box>
                      ) : (
                        <Typography sx={{ color: "#aaa", fontSize: "0.85rem" }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#262626", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Tooltip title={row.video_title || ""}>
                        <span>{row.video_title || "（暂无标题）"}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ color: "#555", fontSize: "0.85rem" }}>
                      {row.author_name || "—"}
                    </TableCell>
                    <TableCell sx={{ color: "#555", fontSize: "0.85rem" }}>
                      {row.user_nickname}
                    </TableCell>
                    <TableCell sx={{ color: "#666", fontSize: "0.85rem" }}>
                      {row.created_at}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center", display: "flex", gap: 1, justifyContent: "center" }}>
                      <Tooltip title="跳转原视频">
                        <IconButton
                          size="small"
                          href={row.video_url}
                          target="_blank"
                          sx={{ color: "#999", "&:hover": { color: "#ff2442" } }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={!row.completed_at}
                        startIcon={<VisibilityOutlinedIcon />}
                        onClick={() => setSelectedItem(row)}
                        sx={{
                          borderRadius: "8px",
                          borderColor: "#ff2442",
                          color: "#ff2442",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "none",
                          "&:hover": {
                            bgcolor: "#fff0f2",
                            borderColor: "#ff2442",
                          },
                        }}
                      >
                        详情 JSON
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: "center", py: 5, color: "#999" }}>
                      暂无符合条件的短视频分析记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage="每页行数:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} 之共 ${count}`}
            />
          </>
        )}
      </TableContainer>

      {/* JSON Viewer Dialog */}
      <Dialog
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        fullWidth
        maxWidth="md"
        slotProps={{
          paper: {
            sx: { borderRadius: "18px", p: 1 }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          视频拉片分析报告数据快照 — {selectedItem?.video_title.slice(0, 30)}
          <IconButton size="small" onClick={() => setSelectedItem(null)} sx={{ color: "#aaa" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Box
            component="pre"
            sx={{
              p: 2,
              borderRadius: "12px",
              bgcolor: "#1e1e2f",
              color: "#a9b2c3",
              fontSize: 12,
              fontFamily: "monospace",
              overflow: "auto",
              maxHeight: 500,
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {selectedItem?.report_json ? JSON.stringify(selectedItem.report_json, null, 2) : "（分析报告数据为空）"}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
