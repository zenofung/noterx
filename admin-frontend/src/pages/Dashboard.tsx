import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  LinearProgress,
  Divider,
} from "@mui/material";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import FindInPageOutlinedIcon from "@mui/icons-material/FindInPageOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";
import { getStats } from "../utils/api";

interface StatsData {
  counts: {
    total_users: number;
    total_guests: number;
    total_members: number;
    total_notes: number;
    total_videos: number;
    completed_videos: number;
    total_feedbacks: number;
  };
  note_categories: Record<string, number>;
}

export default function Dashboard() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then((res) => {
        if (res.success) {
          setData(res);
        }
      })
      .catch((err) => console.error("Error fetching stats:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress sx={{ color: "#ff2442" }} />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">暂无统计数据，请稍后刷新重试</Typography>
      </Box>
    );
  }

  const { counts, note_categories } = data;

  const cards = [
    {
      title: "用户总数",
      value: counts.total_users,
      subtitle: `注册会员: ${counts.total_members} | 游客: ${counts.total_guests}`,
      icon: <PeopleAltOutlinedIcon sx={{ fontSize: 32, color: "#ff2442" }} />,
      bg: "linear-gradient(135deg, #fffcfd 0%, #fff6f8 100%)",
      border: "1px solid #ffccd3",
    },
    {
      title: "图文笔记诊断",
      value: counts.total_notes,
      subtitle: "总累计诊断次数",
      icon: <FindInPageOutlinedIcon sx={{ fontSize: 32, color: "#2563eb" }} />,
      bg: "linear-gradient(135deg, #f7faff 0%, #edf4ff 100%)",
      border: "1px solid #bfdbfe",
    },
    {
      title: "视频拉片分析",
      value: counts.total_videos,
      subtitle: `已完成: ${counts.completed_videos} | 执行中: ${counts.total_videos - counts.completed_videos}`,
      icon: <VideocamOutlinedIcon sx={{ fontSize: 32, color: "#16a34a" }} />,
      bg: "linear-gradient(135deg, #f5fdf7 0%, #ebfaf0 100%)",
      border: "1px solid #bbf7d0",
    },
    {
      title: "客服反馈留言",
      value: counts.total_feedbacks,
      subtitle: "待跟进用户诉求与咨询",
      icon: <FeedbackOutlinedIcon sx={{ fontSize: 32, color: "#d97706" }} />,
      bg: "linear-gradient(135deg, #fffbf2 0%, #fff7e6 100%)",
      border: "1px solid #fde68a",
    },
  ];

  // Map category code to name
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

  const totalCatCount = Object.values(note_categories).reduce((a, b) => a + b, 0) || 1;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, color: "#262626", mb: 0.5 }}>
        数据总览看板
      </Typography>
      <Typography variant="body2" sx={{ color: "#888", mb: 3 }}>
        实时系统统计指标，了解用户使用频次与垂类数据分布。
      </Typography>

      {/* Grid of Key Indicator Cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          gap: 2.5,
          mb: 4,
        }}
      >
        {cards.map((c, i) => (
          <Card
            key={i}
            sx={{
              borderRadius: "16px",
              background: c.bg,
              border: c.border,
              boxShadow: "none",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 6px 20px rgba(0,0,0,0.03)",
              },
            }}
          >
            <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: "#666", fontWeight: 700, fontSize: "0.85rem" }}>
                    {c.title}
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: "#1a1a1a", mt: 0.5, letterSpacing: "-0.02em" }}>
                    {c.value.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ p: 1, borderRadius: "10px", bgcolor: "#fff", display: "flex" }}>
                  {c.icon}
                </Box>
              </Box>
              <Divider sx={{ my: 1.5, borderColor: "rgba(0,0,0,0.05)" }} />
              <Typography variant="body2" sx={{ color: "#888", fontSize: "0.75rem", fontWeight: 600 }}>
                {c.subtitle}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Distribution Section */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2.5,
        }}
      >
        <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "0 2px 12px rgba(0,0,0,0.02)" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#262626", mb: 2 }}>
              诊断类目垂类分布（图文）
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {Object.entries(note_categories).map(([cat, count]) => {
                const pct = (count / totalCatCount) * 100;
                return (
                  <Box key={cat}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#555", fontSize: "0.8rem" }}>
                        {catNames[cat] || cat}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: "#ff2442", fontSize: "0.8rem" }}>
                        {count} 次 ({pct.toFixed(1)}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: "#f5f5f5",
                        "& .MuiLinearProgress-bar": {
                          borderRadius: 3,
                          bgcolor: "#ff2442",
                        },
                      }}
                    />
                  </Box>
                );
              })}
              {Object.keys(note_categories).length === 0 && (
                <Typography variant="body2" sx={{ color: "#bbb", textAlign: "center", py: 3 }}>
                  暂无诊断分类分布数据
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: "16px", border: "1px solid #f0f0f0", boxShadow: "0 2px 12px rgba(0,0,0,0.02)" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#262626", mb: 2 }}>
              系统服务运行状态
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Box>
                <Typography variant="body2" sx={{ color: "#666", mb: 0.5, fontWeight: 700, fontSize: "0.8rem" }}>
                  短视频拉片分析完成率
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={counts.total_videos ? (counts.completed_videos / counts.total_videos) * 100 : 100}
                    sx={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      bgcolor: "#f5f5f5",
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 4,
                        bgcolor: "#16a34a",
                      },
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 800, color: "#16a34a", minWidth: 40, fontSize: "0.8rem" }}>
                    {counts.total_videos ? ((counts.completed_videos / counts.total_videos) * 100).toFixed(0) : 100}%
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <Box sx={{ p: 2, bgcolor: "#fafafa", borderRadius: "12px", border: "1px solid #f0f0f0" }}>
                  <Typography variant="body2" sx={{ color: "#999", fontSize: "0.75rem", fontWeight: 600 }}>会员占比</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "#262626", mt: 0.5 }}>
                    {counts.total_users ? ((counts.total_members / counts.total_users) * 100).toFixed(1) : 0}%
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: "#fafafa", borderRadius: "12px", border: "1px solid #f0f0f0" }}>
                  <Typography variant="body2" sx={{ color: "#999", fontSize: "0.75rem", fontWeight: 600 }}>游客占比</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "#262626", mt: 0.5 }}>
                    {counts.total_users ? ((counts.total_guests / counts.total_users) * 100).toFixed(1) : 0}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
