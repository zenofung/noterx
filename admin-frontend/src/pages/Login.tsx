import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { adminLogin } from "../utils/api";

export default function Login() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pwdTrimmed = password.trim();

    if (!pwdTrimmed) {
      setError("请输入管理员密码");
      return;
    }

    setLoading(true);
    try {
      const res = await adminLogin(pwdTrimmed);
      if (res.success && res.token) {
        localStorage.setItem("noterx_admin_token", res.token);
        localStorage.setItem("noterx_admin_user", JSON.stringify(res.user));
        navigate("/dashboard");
      } else {
        setError(res.message || "登录失败");
      }
    } catch (err: any) {
      console.error("Admin login error:", err);
      const errMsg = err.response?.data?.detail || "网络请求异常，请检查后端是否已启动";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e1e2f 0%, #111115 100%)",
        px: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 400,
          width: "100%",
          borderRadius: "20px",
          bgcolor: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          {/* Logo icon */}
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              bgcolor: "#ff2442",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
              boxShadow: "0 4px 20px rgba(255, 36, 66, 0.3)",
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 28 }} />
          </Box>

          <Typography
            variant="h5"
            sx={{ fontWeight: 800, color: "#fff", mb: 0.5, fontSize: "1.35rem" }}
          >
            薯医 NoteRx
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{ color: "#88889a", mb: 4, letterSpacing: "0.05em" }}
          >
            后台管理系统
          </Typography>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: "12px",
                bgcolor: "rgba(239, 68, 68, 0.1)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                fontSize: 12,
                textAlign: "left",
                "& .MuiAlert-icon": { color: "#f87171" },
              }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              required
              fullWidth
              type="password"
              label="管理员密码"
              placeholder="请输入管理员安全登录密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="outlined"
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{
                mb: 3,
                "& .MuiOutlinedInput-root": {
                  color: "#fff",
                  borderRadius: "12px",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
                  "&:hover fieldset": { borderColor: "#ff2442" },
                  "&.Mui-focused fieldset": { borderColor: "#ff2442" },
                },
                "& .MuiInputLabel-root": {
                  color: "rgba(255,255,255,0.6)",
                  "&.Mui-focused": { color: "#ff2442" },
                },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                py: 1.5,
                borderRadius: "12px",
                fontWeight: 800,
                fontSize: 14,
                bgcolor: "#ff2442",
                color: "#fff",
                textTransform: "none",
                boxShadow: "0 4px 16px rgba(255, 36, 66, 0.2)",
                "&:hover": {
                  bgcolor: "#cc1a35",
                  boxShadow: "0 6px 20px rgba(255, 36, 66, 0.3)",
                },
              }}
            >
              {loading ? (
                <CircularProgress size={20} sx={{ color: "#fff" }} />
              ) : (
                "进入后台"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
