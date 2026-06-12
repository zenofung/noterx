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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { getDiagnoses } from "../utils/api";

interface DiagnosisItem {
  id: string;
  user_id: string | null;
  user_nickname: string;
  title: string;
  category: string;
  overall_score: number;
  created_at: string;
  grade: string;
  report_json: any;
}

export default function Diagnoses() {
  const [items, setItems] = useState<DiagnosisItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState("");

  // Details dialog state
  const [selectedItem, setSelectedItem] = useState<DiagnosisItem | null>(null);

  const fetchDiagnoses = () => {
    setLoading(true);
    const limit = rowsPerPage;
    const offset = page * rowsPerPage;
    getDiagnoses(limit, offset, search)
      .then((res) => {
        if (res.success) {
          setItems(res.items);
          setTotal(res.total);
        }
      })
      .catch((err) => console.error("Error fetching diagnoses:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDiagnoses();
  }, [page, rowsPerPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchDiagnoses();
  };

  const catNames: Record<string, string> = {
    food: "美食",
    fashion: "时尚",
    tech: "科技",
    travel: "旅行",
    beauty: "美妆",
    fitness: "健身",
    lifestyle: "生活",
    home: "家居",
    _default: "其他",
  };

  const getGradeColor = (grade: string) => {
    const map: Record<string, string> = {
      S: "#ea580c",
      A: "#16a34a",
      B: "#2563eb",
      C: "#d97706",
      D: "#dc2626",
    };
    return map[grade] || "#ff2442";
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#262626", mb: 0.5 }}>
            图文笔记诊断记录
          </Typography>
          <Typography variant="body2" sx={{ color: "#888" }}>
            查看平台用户生成的所有小红书图文笔记诊断报告，提供完整数据结构快照查询。
          </Typography>
        </Box>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit}>
          <TextField
            size="small"
            placeholder="搜索笔记标题/分类..."
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

      {/* Table container */}
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
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>诊断分数</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>笔记标题</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>类别垂类</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>申请用户</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>诊断时间</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555", textAlign: "center" }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: "1.2rem", color: getGradeColor(row.grade) }}>
                          {Math.round(row.overall_score)}
                        </Typography>
                        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: getGradeColor(row.grade) }}>
                          ({row.grade}级)
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#262626", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.title}
                    </TableCell>
                    <TableCell sx={{ color: "#555", fontSize: "0.85rem" }}>
                      {catNames[row.category] || row.category}
                    </TableCell>
                    <TableCell sx={{ color: "#555", fontSize: "0.85rem" }}>
                      {row.user_nickname}
                    </TableCell>
                    <TableCell sx={{ color: "#666", fontSize: "0.85rem" }}>
                      {row.created_at}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      <Button
                        size="small"
                        variant="outlined"
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
                    <TableCell colSpan={6} sx={{ textAlign: "center", py: 5, color: "#999" }}>
                      暂无符合条件的图文诊断记录
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
          诊断报告快照 — {selectedItem?.title.slice(0, 30)}
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
            {selectedItem?.report_json ? JSON.stringify(selectedItem.report_json, null, 2) : "（快照数据为空）"}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
