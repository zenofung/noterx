import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
} from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import FindInPageOutlinedIcon from "@mui/icons-material/FindInPageOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Diagnoses from "./pages/Diagnoses";
import VideoAnalyses from "./pages/VideoAnalyses";
import Feedbacks from "./pages/Feedbacks";

const DRAWER_WIDTH = 240;

// Protected Layout wrapper
function Layout({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("noterx_admin_token");
  const location = useLocation();
  const navigate = useNavigate();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const handleLogout = () => {
    localStorage.removeItem("noterx_admin_token");
    localStorage.removeItem("noterx_admin_user");
    navigate("/login");
  };

  const menuItems = [
    { text: "总览仪表盘", path: "/dashboard", icon: <DashboardOutlinedIcon /> },
    { text: "用户管理", path: "/users", icon: <PeopleAltOutlinedIcon /> },
    { text: "图文诊断历史", path: "/diagnoses", icon: <FindInPageOutlinedIcon /> },
    { text: "视频拉片任务", path: "/video-analyses", icon: <VideocamOutlinedIcon /> },
    { text: "反馈留言面板", path: "/feedbacks", icon: <FeedbackOutlinedIcon /> },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#fcfcfa" }}>
      {/* AppBar (Header) */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: `calc(100% - ${DRAWER_WIDTH}px)`,
          ml: `${DRAWER_WIDTH}px`,
          bgcolor: "#fff",
          borderBottom: "1px solid #f0f0f0",
          color: "#262626",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1a1a1a" }}>
            系统管理控制台
          </Typography>
          <Button
            size="small"
            startIcon={<ExitToAppIcon />}
            onClick={handleLogout}
            sx={{
              color: "#666",
              fontWeight: 700,
              fontSize: 13,
              textTransform: "none",
              borderRadius: "8px",
              "&:hover": { color: "#ff2442", bgcolor: "#fff0f2" },
            }}
          >
            退出登录
          </Button>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Drawer
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "#1e1e2f",
            color: "rgba(255, 255, 255, 0.8)",
            borderRight: "none",
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 8, height: 20, bgcolor: "#ff2442", borderRadius: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 900, color: "#fff", fontSize: "1.1rem", letterSpacing: "0.02em" }}>
            薯医 NoteRx
          </Typography>
        </Box>
        <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.08)" }} />
        
        <List sx={{ px: 1.5, py: 2 }}>
          {menuItems.map((item) => {
            const isSelected = location.pathname === item.path;
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.8 }}>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  sx={{
                    borderRadius: "10px",
                    bgcolor: isSelected ? "#ff2442" : "transparent",
                    color: isSelected ? "#fff" : "rgba(255,255,255,0.7)",
                    "&:hover": {
                      bgcolor: isSelected ? "#ff2442" : "rgba(255,255,255,0.05)",
                      color: "#fff",
                    },
                    "& .MuiListItemIcon-root": {
                      color: isSelected ? "#fff" : "rgba(255,255,255,0.5)",
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    slotProps={{
                      primary: {
                        sx: { fontWeight: isSelected ? 800 : 500, fontSize: "0.85rem" }
                      }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Drawer>

      {/* Main Page Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2.5, md: 4 },
          width: `calc(100% - ${DRAWER_WIDTH}px)`,
          pt: "88px", // Margin for top appbar
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Panel Routes */}
        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/users"
          element={
            <Layout>
              <Users />
            </Layout>
          }
        />
        <Route
          path="/diagnoses"
          element={
            <Layout>
              <Diagnoses />
            </Layout>
          }
        />
        <Route
          path="/video-analyses"
          element={
            <Layout>
              <VideoAnalyses />
            </Layout>
          }
        />
        <Route
          path="/feedbacks"
          element={
            <Layout>
              <Feedbacks />
            </Layout>
          }
        />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
