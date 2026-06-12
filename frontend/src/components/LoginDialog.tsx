import React, { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogTitle, DialogContent, Box, Tab, Tabs,
  TextField, Button, Typography, CircularProgress,
  IconButton
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import { motion, AnimatePresence } from "framer-motion";
import {
  sendSmsCode, loginWithSms, getWechatQrCode,
  pollWechatLogin, loginAsGuest, type User
} from "../utils/api";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
}

// Simple WeChat SVG Icon for WeChat scan tab
const WeChatSvgIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...props}>
    <path d="M8.28 2.02c-4.08 0-7.39 2.87-7.39 6.42 0 1.94.99 3.69 2.54 4.88-.2.61-.73 2.22-.73 2.22s1.58-.8 2.7-.1c.88.54 1.91.86 3.01.86.34 0 .68-.03 1.01-.08-.43-1.02-.68-2.12-.68-3.28 0-4.32 3.67-7.83 8.19-7.83.43 0 .86.03 1.28.1-.88-3.79-4.88-6.19-9.93-6.19zm-2.73 4.2c-.41 0-.75-.34-.75-.75s.34-.75.75-.75c.41 0 .75.34.75.75s-.34.75-.75.75zm5.06 0c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zm8.43 3.67c-3.41 0-6.19 2.39-6.19 5.34 0 2.95 2.78 5.34 6.19 5.34.8 0 1.57-.18 2.24-.51.84.53 2 .06 2 .06s-.46-1.22-.59-1.68c1.07-.9 1.74-2.18 1.74-3.56 0-2.95-2.78-5.34-6.19-5.34zm-2.02 3.49c-.31 0-.56-.25-.56-.56s.25-.56.56-.56c.31 0 .56.25.56.56s-.25.56-.56.56zm3.94 0c-.31 0-.56-.25-.56-.56s.25-.56.56-.56.56.25.56.56-.25.56-.56.56z"/>
  </svg>
);

export default function LoginDialog({ open, onClose, onLoginSuccess }: LoginDialogProps) {
  const [tabIndex, setTabIndex] = useState(0);

  // --- SMS Auth States ---
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState("");
  const [smsSuccess, setSmsSuccess] = useState("");
  
  // SMS Countdown timer
  const [countdown, setCountdown] = useState(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- WeChat Scan Auth States ---
  const [wechatTicket, setWechatTicket] = useState("");
  const [wechatQrUrl, setWechatQrUrl] = useState("");
  const [wechatStatus, setWechatStatus] = useState<"loading" | "waiting" | "scanned" | "success" | "error">("loading");
  const [wechatMsg, setWechatMsg] = useState("正在生成二维码...");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Guest Auth States ---
  const [guestLoading, setGuestLoading] = useState(false);

  // Clear errors when tab changes
  useEffect(() => {
    setSmsError("");
    setSmsSuccess("");
  }, [tabIndex]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      stopCountdown();
      stopWechatPolling();
    };
  }, []);

  // --- SMS Timers ---
  const startCountdown = () => {
    setCountdown(60);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopCountdown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const handleSendCode = async () => {
    if (countdown > 0) return;
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      setSmsError("请输入正确的11位中国手机号");
      return;
    }
    setSmsError("");
    setSmsSuccess("");
    try {
      await sendSmsCode(phone.trim());
      setSmsSuccess("验证码发送成功！请在后端控制台终端查看验证码");
      startCountdown();
    } catch (e: any) {
      setSmsError(e.response?.data?.detail || "发送验证码失败");
    }
  };

  const handleSmsLogin = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      setSmsError("请输入正确的11位手机号");
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setSmsError("请输入6位数字验证码");
      return;
    }
    setSmsError("");
    setSmsSuccess("");
    setSmsLoading(true);
    try {
      const res = await loginWithSms(phone.trim(), code.trim());
      onLoginSuccess(res.user, res.token);
      onClose();
    } catch (e: any) {
      setSmsError(e.response?.data?.detail || "登录失败，验证码可能已失效");
    } finally {
      setSmsLoading(false);
    }
  };

  // --- WeChat QR Scan Logic ---
  const initWechatQr = async () => {
    stopWechatPolling();
    setWechatStatus("loading");
    setWechatMsg("正在生成二维码...");
    try {
      const res = await getWechatQrCode();
      setWechatTicket(res.ticket);
      setWechatQrUrl(res.qr_url);
      setWechatStatus("waiting");
      setWechatMsg("请微信扫码登录");
      
      // Start polling status
      startWechatPolling(res.ticket);
    } catch (e) {
      setWechatStatus("error");
      setWechatMsg("生成二维码失败，请重试");
    }
  };

  const startWechatPolling = (ticket: string) => {
    stopWechatPolling();
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await pollWechatLogin(ticket);
        if (res.status === "waiting_scan") {
          setWechatStatus("waiting");
          setWechatMsg("等待扫码中...");
        } else if (res.status === "scanned") {
          setWechatStatus("scanned");
          setWechatMsg("已扫码，请在手机端确认授权...");
        } else if (res.status === "success" && res.token) {
          setWechatStatus("success");
          setWechatMsg("扫码成功，正在进入系统...");
          stopWechatPolling();
          // Delay briefly to show success state
          setTimeout(() => {
            onLoginSuccess(res.user, res.token);
            onClose();
          }, 800);
        }
      } catch (e) {
        // Log errors but keep polling (or stop on fatal expired ticket)
        console.error("WeChat polling status error:", e);
      }
    }, 2000);
  };

  const stopWechatPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (open && tabIndex === 1) {
      initWechatQr();
    } else {
      stopWechatPolling();
    }
  }, [open, tabIndex]);

  // --- Guest Auth Logic ---
  const handleGuestLogin = async () => {
    setGuestLoading(true);
    try {
      const res = await loginAsGuest();
      onLoginSuccess(res.user, res.token);
      onClose();
    } catch (e: any) {
      console.error(e);
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "24px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            overflow: "hidden",
            bgcolor: "#fff",
            p: 3,
            position: "relative",
          }
        }
      }}
    >
      {/* Header Close button */}
      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          right: 16,
          top: 16,
          color: "#aaa",
          "&:hover": { color: "#333", bgcolor: "#f5f5f5" },
        }}
      >
        <CloseIcon sx={{ fontSize: 20 }} />
      </IconButton>

      <DialogTitle sx={{ p: 0, mb: 3, textAlign: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: "#1a1a1a", fontSize: 20 }}>
          登录 / 注册 薯医
        </Typography>
        <Typography sx={{ fontSize: 12, color: "#888", mt: 0.5 }}>
          诊断爆款小红书笔记，获取专属多模态建议
        </Typography>
      </DialogTitle>

      <Tabs
        value={tabIndex}
        onChange={(_, val) => setTabIndex(val)}
        variant="fullWidth"
        sx={{
          minHeight: 40,
          mb: 3,
          "& .MuiTabs-indicator": {
            bgcolor: "#ff2442",
            height: 3,
            borderRadius: 1.5,
          },
          "& .MuiTab-root": {
            textTransform: "none",
            fontSize: 13,
            fontWeight: 700,
            color: "#888",
            minHeight: 40,
            py: 1,
            "&.Mui-selected": {
              color: "#ff2442",
            }
          }
        }}
      >
        <Tab icon={<PhoneAndroidIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="手机验证码" />
        <Tab icon={<WeChatSvgIcon />} iconPosition="start" label="微信扫码" />
        <Tab icon={<PersonOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="游客体验" />
      </Tabs>

      <DialogContent sx={{ p: 0, overflow: "visible" }}>
        <AnimatePresence mode="wait">
          {tabIndex === 0 && (
            <motion.div
              key="sms-tab"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.2 }}
            >
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                <TextField
                  fullWidth
                  placeholder="手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "14px",
                      bgcolor: "#fcfbfa",
                    }
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <PhoneAndroidIcon sx={{ color: "#aaa", mr: 1, fontSize: 18 }} />
                      )
                    }
                  }}
                />

                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <TextField
                    placeholder="输入验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    sx={{
                      flex: 1,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "14px",
                        bgcolor: "#fcfbfa",
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendCode}
                    disabled={countdown > 0}
                    sx={{
                      borderRadius: "14px",
                      px: 2,
                      fontSize: 12,
                      fontWeight: 700,
                      color: countdown > 0 ? "#888" : "#ff2442",
                      border: `1.5px solid ${countdown > 0 ? "#ddd" : "#ff2442"}`,
                      minWidth: 110,
                      "&:hover": {
                        bgcolor: "rgba(255,36,66,0.04)",
                        borderColor: "#ff2442",
                      }
                    }}
                  >
                    {countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
                  </Button>
                </Box>

                {smsError && (
                  <Typography sx={{ fontSize: 12, color: "#dc2626", mt: -0.5 }}>
                    ⚠️ {smsError}
                  </Typography>
                )}
                
                {smsSuccess && (
                  <Typography sx={{ fontSize: 12, color: "#16a34a", mt: -0.5 }}>
                    ✓ {smsSuccess}
                  </Typography>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleSmsLogin}
                  disabled={smsLoading}
                  sx={{
                    py: 1.5,
                    borderRadius: "14px",
                    fontWeight: 800,
                    fontSize: 15,
                    boxShadow: "0 6px 20px rgba(255,36,66,0.2)",
                    background: "linear-gradient(135deg, #ff5c6f, #e61e3d)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #e61e3d, #cc1a35)",
                      boxShadow: "0 8px 24px rgba(255,36,66,0.3)",
                    }
                  }}
                >
                  {smsLoading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "验证码登录 / 注册"}
                </Button>
              </Box>
            </motion.div>
          )}

          {tabIndex === 1 && (
            <motion.div
              key="wechat-tab"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.2 }}
            >
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 1, gap: 2 }}>
                {wechatStatus === "loading" ? (
                  <Box sx={{ width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CircularProgress size={40} sx={{ color: "#ff2442" }} />
                  </Box>
                ) : (
                  <Box sx={{ position: "relative", width: 200, height: 200, border: "1px solid #eee", borderRadius: "16px", overflow: "hidden", p: 1, bgcolor: "#fff" }}>
                    <img
                      src={wechatQrUrl}
                      alt="WeChat Login QR"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        opacity: wechatStatus === "waiting" ? 1 : 0.35,
                        transition: "opacity 0.3s"
                      }}
                    />
                    
                    {/* Mock Scan success indicator overlays */}
                    {wechatStatus === "scanned" && (
                      <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "rgba(255,255,255,0.7)" }}>
                        <Typography sx={{ color: "#16a34a", fontWeight: 800, fontSize: 14 }}>✓ 已扫码</Typography>
                        <Typography sx={{ color: "#555", fontSize: 11, mt: 0.5 }}>请在手机上确认</Typography>
                      </Box>
                    )}
                    {wechatStatus === "success" && (
                      <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "rgba(255,255,255,0.9)" }}>
                        <Typography sx={{ color: "#ff2442", fontWeight: 800, fontSize: 16 }}>登录成功</Typography>
                        <Typography sx={{ color: "#888", fontSize: 11, mt: 0.5 }}>正在为您跳转...</Typography>
                      </Box>
                    )}
                  </Box>
                )}

                <Typography sx={{ fontSize: 13, fontWeight: 700, color: wechatStatus === "error" ? "#dc2626" : "#262626", textAlign: "center" }}>
                  {wechatMsg}
                </Typography>
                
                <Typography sx={{ fontSize: 11, color: "#999", px: 2, textAlign: "center", lineHeight: 1.5 }}>
                  使用微信扫描二维码关注或授权以安全注册/登录
                </Typography>

                {/* Simulated Scan button for developer testing bypass */}
                {wechatStatus !== "success" && wechatStatus !== "loading" && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={async () => {
                      // Fast forward mock WeChat scanning sequence
                      setWechatStatus("scanned");
                      setWechatMsg("已扫码，确认登录中...");
                      
                      // Wait a brief second then complete the mock login request
                      setTimeout(async () => {
                        try {
                          const res = await pollWechatLogin(wechatTicket);
                          // For simulation, if it didn't complete organically yet, force it:
                          if (res.status === "success" && res.token) {
                            setWechatStatus("success");
                            setWechatMsg("扫码成功！");
                            onLoginSuccess(res.user, res.token);
                            onClose();
                          } else {
                            // If organic polling hasn't finished, force logging in guest/mock openid
                            const guestRes = await loginAsGuest();
                            // Rename user to simulate wechat
                            const wechatUser: User = {
                              ...guestRes.user,
                              nickname: `扫码测试用户_${guestRes.user.nickname.split("_")[1]}`,
                              avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestRes.user.id}`
                            };
                            onLoginSuccess(wechatUser, guestRes.token);
                            onClose();
                          }
                        } catch (err) {
                          // Bypass directly to Guest Login to assure scan testing always works
                          const guestRes = await loginAsGuest();
                          onLoginSuccess(guestRes.user, guestRes.token);
                          onClose();
                        }
                      }, 1000);
                    }}
                    sx={{
                      color: "#16a34a",
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: "6px",
                      textDecoration: "underline",
                      "&:hover": { bgcolor: "rgba(22,163,74,0.06)", textDecoration: "underline" }
                    }}
                  >
                    🛠️ 模拟扫码成功（免扫码测试入口）
                  </Button>
                )}
              </Box>
            </motion.div>
          )}

          {tabIndex === 2 && (
            <motion.div
              key="guest-tab"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.2 }}
            >
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3, py: 1, textAlign: "center" }}>
                <Box sx={{
                  width: 56, height: 56, borderRadius: "50%",
                  bgcolor: "rgba(255,36,66,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  mx: "auto"
                }}>
                  <PersonOutlinedIcon sx={{ color: "#ff2442", fontSize: 28 }} />
                </Box>
                
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#262626" }}>
                    以临时游客身份继续
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#888", mt: 1, px: 2, lineHeight: 1.6 }}>
                    选择游客模式将分配一个临时的随机昵称，您可以免费对视频及截图进行分析，后期可随时在后台绑定手机号或微信号。
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleGuestLogin}
                  disabled={guestLoading}
                  sx={{
                    py: 1.4,
                    borderRadius: "14px",
                    fontWeight: 800,
                    fontSize: 14,
                    color: "#ff2442",
                    borderColor: "#ff2442",
                    "&:hover": {
                      bgcolor: "rgba(255,36,66,0.04)",
                      borderColor: "#e61e3d",
                    }
                  }}
                >
                  {guestLoading ? <CircularProgress size={22} sx={{ color: "#ff2442" }} /> : "以游客身份进入"}
                </Button>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
