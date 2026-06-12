import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HeadsetIcon from "@mui/icons-material/Headset";
import HelpOutlinedIcon from "@mui/icons-material/HelpOutlined";
import ChatIcon from "@mui/icons-material/Chat";
import { submitFeedback } from "../utils/api";
import { showToast } from "./Toast";

interface ContactFeedbackProps {
  resultId?: string;
  resultType: "note" | "video";
  reportTitle?: string;
  reportJson?: any;
}

export default function ContactFeedback({
  resultId,
  resultType,
  reportTitle = "",
  reportJson,
}: ContactFeedbackProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [attachReport, setAttachReport] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
    setMessage("");
    setContact("");
    setAttachReport(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgTrimmed = message.trim();
    const contactTrimmed = contact.trim();

    if (!msgTrimmed) {
      showToast("请输入您的留言内容");
      return;
    }
    if (msgTrimmed.length < 5) {
      showToast("留言内容过短，请输入至少5个字符");
      return;
    }
    if (!contactTrimmed) {
      showToast("请输入您的联系方式（手机号或邮箱）");
      return;
    }

    // Basic verification for phone or email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(contactTrimmed) && !emailRegex.test(contactTrimmed)) {
      showToast("联系方式格式不正确，请输入正确的手机号或邮箱");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitFeedback({
        result_id: resultId,
        result_type: resultType,
        report_title: reportTitle,
        report_json: attachReport ? reportJson : null,
        message_content: msgTrimmed,
        contact_info: contactTrimmed,
      });

      if (res.success) {
        showToast("提交成功！客服人员会尽快联系您。");
        handleClose();
      } else {
        showToast(res.message || "提交失败，请稍后重试");
      }
    } catch (err: any) {
      console.error("提交客服留言失败:", err);
      const errMsg = err.response?.data?.detail || "网络异常，提交失败";
      showToast(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ mt: 3, mb: 1 }}>
      {/* ── 客服小卡片入口 ── */}
      <Box
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: "18px",
          background: "linear-gradient(135deg, #fffcfd 0%, #fff6f8 100%)",
          border: "1.5px dashed #fecaca",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
          boxShadow: "0 4px 20px rgba(255, 36, 66, 0.02)",
          transition: "all 0.3s ease",
          "&:hover": {
            borderColor: "#ff5c72",
            boxShadow: "0 6px 24px rgba(255, 36, 66, 0.05)",
          },
        }}
      >
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: "12px",
              bgcolor: "#fff0f2",
              color: "#ff2442",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <HeadsetIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography
              sx={{ fontWeight: 800, color: "#262626", fontSize: 15, mb: 0.5 }}
            >
              对诊断结果有疑问？获取专业陪跑咨询
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
              如果您需要人工深度拆解、小红书陪跑服务，或对 AI 评分及优化有其他疑问，可随时联系客服。
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          disableElevation
          onClick={handleOpen}
          startIcon={<ChatIcon />}
          sx={{
            flexShrink: 0,
            bgcolor: "#ff2442",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            px: 3,
            py: 1,
            borderRadius: "12px",
            textTransform: "none",
            "&:hover": {
              bgcolor: "#cc1a35",
            },
          }}
        >
          联系客服留言
        </Button>
      </Box>

      {/* ── 留言表单弹窗 ── */}
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            sx: {
              borderRadius: "20px",
              overflow: "hidden",
              p: 1.5,
              position: "relative",
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            fontSize: 16,
            color: "#262626",
            pb: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <HelpOutlinedIcon sx={{ color: "#ff2442" }} />
          联系客服留下疑问
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{
              position: "absolute",
              right: 16,
              top: 16,
              color: "#aaa",
              "&:hover": { color: "#333" },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>

        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ py: 1 }}>
            <Typography
              variant="body2"
              sx={{ color: "#666", mb: 2, fontSize: 12, lineHeight: 1.6 }}
            >
              请在下方写下您的具体诉求、改写建议或疑惑（不少于 5
              字），并留下您的手机号或邮箱，我们的专业运营人员会尽快与您联系。
            </Typography>

            <TextField
              autoFocus
              required
              multiline
              rows={4}
              label="您的留言内容"
              placeholder="例如：我觉得这个标题的点击打分偏低了，想要人工运营分析一下该怎么针对美食垂类做更好的改写..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              fullWidth
              variant="outlined"
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  "&:hover fieldset": { borderColor: "#ff2442" },
                  "&.Mui-focused fieldset": { borderColor: "#ff2442" },
                },
                "& .MuiInputLabel-root.Mui-focused": { color: "#ff2442" },
              }}
            />

            <TextField
              required
              label="联系方式 (手机号或邮箱)"
              placeholder="请输入手机号或邮箱，便于客服回复您"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              fullWidth
              variant="outlined"
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  "&:hover fieldset": { borderColor: "#ff2442" },
                  "&.Mui-focused fieldset": { borderColor: "#ff2442" },
                },
                "& .MuiInputLabel-root.Mui-focused": { color: "#ff2442" },
              }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={attachReport}
                  onChange={(e) => setAttachReport(e.target.checked)}
                  size="small"
                  sx={{
                    color: "#ff2442",
                    "&.Mui-checked": { color: "#ff2442" },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: 12, color: "#666" }}>
                  附带当前的 AI 分析结果备份（方便客服快速查看快照）
                </Typography>
              }
            />
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 1.5, pt: 1, gap: 1 }}>
            <Button
              onClick={handleClose}
              disabled={submitting}
              sx={{
                color: "#999",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: "10px",
                px: 2.5,
              }}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="contained"
              disableElevation
              disabled={submitting}
              sx={{
                bgcolor: "#ff2442",
                fontWeight: 800,
                textTransform: "none",
                borderRadius: "10px",
                px: 3,
                "&:hover": {
                  bgcolor: "#cc1a35",
                },
              }}
            >
              {submitting ? (
                <CircularProgress size={18} sx={{ color: "#fff" }} />
              ) : (
                "确认提交"
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
