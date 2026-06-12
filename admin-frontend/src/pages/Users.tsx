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
  Avatar,
  Chip,
  TablePagination,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { getUsers } from "../utils/api";

interface UserItem {
  id: string;
  phone: string | null;
  nickname: string;
  avatar_url: string;
  role: string;
  is_guest: boolean;
  created_at: string;
}

export default function Users() {
  const [items, setItems] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState("");

  const fetchUsers = () => {
    setLoading(true);
    const limit = rowsPerPage;
    const offset = page * rowsPerPage;
    getUsers(limit, offset, search)
      .then((res) => {
        if (res.success) {
          setItems(res.items);
          setTotal(res.total);
        }
      })
      .catch((err) => console.error("Error fetching users:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchUsers();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#262626", mb: 0.5 }}>
            用户账号管理
          </Typography>
          <Typography variant="body2" sx={{ color: "#888" }}>
            管理并监控注册会员以及游客的使用状态。
          </Typography>
        </Box>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit}>
          <TextField
            size="small"
            placeholder="搜索昵称/手机号..."
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

      {/* Users Table */}
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
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>用户昵称</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>手机号</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>账户类别</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>权限角色</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>注册时间</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: "#555" }}>用户唯一标识 ID</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar src={row.avatar_url} sx={{ width: 32, height: 32 }} />
                      <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#262626" }}>
                        {row.nickname}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: "#555", fontSize: "0.85rem" }}>
                      {row.phone || "—"}
                    </TableCell>
                    <TableCell>
                      {row.is_guest ? (
                        <Chip label="游客 (临时)" size="small" sx={{ bgcolor: "#f3f4f6", color: "#6b7280", fontWeight: 700, fontSize: "0.75rem", borderRadius: "6px" }} />
                      ) : (
                        <Chip label="会员 (正式)" size="small" sx={{ bgcolor: "#fff0f2", color: "#ff2442", fontWeight: 700, fontSize: "0.75rem", borderRadius: "6px" }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {row.role === "admin" ? (
                        <Chip label="管理员" size="small" sx={{ bgcolor: "#eff6ff", color: "#2563eb", fontWeight: 700, fontSize: "0.75rem", borderRadius: "6px" }} />
                      ) : (
                        <Chip label="普通用户" size="small" sx={{ bgcolor: "#fafafa", color: "#666", border: "1px solid #eee", fontWeight: 700, fontSize: "0.75rem", borderRadius: "6px" }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ color: "#666", fontSize: "0.85rem" }}>
                      {row.created_at}
                    </TableCell>
                    <TableCell sx={{ color: "#999", fontSize: "0.75rem", fontFamily: "monospace" }}>
                      {row.id}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: "center", py: 5, color: "#999" }}>
                      暂无符合条件的用户记录
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
    </Box>
  );
}
