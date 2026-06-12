import { useEffect, useState } from "react";
import {
  Box,
  Typography,
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
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Card,
  CardContent,
  Stack,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import FindInPageOutlinedIcon from "@mui/icons-material/FindInPageOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import { getFeedbacks } from "../utils/api";

interface FeedbackItem {
  id: number;
  user_id: string | null;
  user_nickname: string;
  result_id: string | null;
  result_type: "note" | "video";
  report_title: string | null;
  report_json: any;
  message_content: string;
  contact_info: string;
  created_at: string;
}

export default function Feedbacks() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  const fetchFeedbacks = () => {
    setLoading(true);
    const limit = rowsPerPage;
    const offset = page * rowsPerPage;
    getFeedbacks(limit, offset)
      .then((res) => {
        if (res.success) {
          setItems(res.items);
          setTotal(res.total);
        }
      })
      .catch((err) => console.error("Error fetching feedbacks:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [page, rowsPerPage]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#262626", mb: 0.5 }}>
          客服反馈留言板
        </Typography>
        <Typography variant="body2" sx={{ color: "#888" }}>
          收集并展示用户在诊断分析报告页面对 AI 生成结果留下的疑问、诉求以及填写的手机号/邮箱联系方式。
        </Typography>
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
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>反馈类型</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>留言内容</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>联系方式</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>当时分析标题</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>发起账号</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>留言时间</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555", textAlign: "center" }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell>
                      {row.result_type === "note" ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "#2563eb" }}>
                          <FindInPageOutlinedIcon sx={{ fontSize: 16 }} />
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700 }}>图文诊断</Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "#16a34a" }}>
                          <VideocamOutlinedIcon sx={{ fontSize: 16 }} />
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700 }}>视频拉片</Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: "#262626", fontWeight: 600, fontSize: "0.85rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.message_content}
                    </TableCell>
                    <TableCell sx={{ color: "#ff2442", fontWeight: 700, fontSize: "0.85rem" }}>
                      {row.contact_info}
                    </TableCell>
                    <TableCell sx={{ color: "#666", fontSize: "0.85rem", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.report_title || "（暂无标题）"}
                    </TableCell>
                    <TableCell sx={{ color: "#666", fontSize: "0.85rem" }}>
                      {row.user_nickname}
                    </TableCell>
                    <TableCell sx={{ color: "#888", fontSize: "0.85rem" }}>
                      {row.created_at}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      <Button
                        size="small"
                        variant="outlined"
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
                        查看留言
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: "center", py: 5, color: "#999" }}>
                      暂无客户反馈或留言记录
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

      {/* Feedback Dialog */}
      <Dialog
        open={!!selectedItem && !snapshotOpen}
        onClose={() => setSelectedItem(null)}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: { borderRadius: "18px", p: 1 }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          留言反馈详情
          <IconButton size="small" onClick={() => setSelectedItem(null)} sx={{ color: "#aaa" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="caption" sx={{ color: "#999", fontWeight: 700 }}>留言用户与时间</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: "#262626", mt: 0.5 }}>
                {selectedItem?.user_nickname} · 提交于 {selectedItem?.created_at}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: "#999", fontWeight: 700 }}>留言内容</Typography>
              <Card sx={{ bgcolor: "#fafafa", borderRadius: "12px", border: "1px solid #f0f0f0", boxShadow: "none", mt: 0.5 }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Typography variant="body2" sx={{ color: "#262626", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {selectedItem?.message_content}
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: "#999", fontWeight: 700 }}>用户联系方式</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, color: "#ff2442", bgcolor: "#fff0f2", p: 1.5, borderRadius: "10px" }}>
                <MarkEmailReadOutlinedIcon sx={{ fontSize: 18 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  {selectedItem?.contact_info}
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: "#999", fontWeight: 700 }}>当时的分析报告标题</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: "#555", mt: 0.5 }}>
                [{selectedItem?.result_type === "note" ? "图文诊断" : "视频拉片"}] {selectedItem?.report_title || "（无标题）"}
              </Typography>
            </Box>

            <Divider />

            {selectedItem?.report_json ? (
              <Button
                variant="contained"
                disableElevation
                onClick={() => setSnapshotOpen(true)}
                sx={{
                  py: 1,
                  borderRadius: "10px",
                  bgcolor: "#ff2442",
                  fontWeight: 800,
                  "&:hover": { bgcolor: "#cc1a35" }
                }}
              >
                查看当时保存的诊断报告快照
              </Button>
            ) : (
              <Typography variant="body2" sx={{ color: "#ccc", fontStyle: "italic", textAlign: "center" }}>
                该反馈未携带任何诊断报告快照
              </Typography>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Snapshot Report JSON Dialog */}
      <Dialog
        open={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        fullWidth
        maxWidth="md"
        slotProps={{
          paper: {
            sx: { borderRadius: "18px", p: 1 }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          诊断快照（当时分析结果 JSON 备份）
          <IconButton size="small" onClick={() => setSnapshotOpen(false)} sx={{ color: "#aaa" }}>
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
            {selectedItem?.report_json ? JSON.stringify(selectedItem.report_json, null, 2) : ""}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
