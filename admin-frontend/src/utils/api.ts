import axios from "axios";

// Create Axios Instance
const api = axios.create({
  baseURL: "", // Vite proxies /api requests to localhost:8000
  timeout: 30000,
});

// Request Interceptor to attach admin token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("noterx_admin_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor to intercept 401/403 and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (window.location.pathname !== "/login") {
        localStorage.removeItem("noterx_admin_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Admin Login
export async function adminLogin(password: string) {
  const { data } = await api.post("/api/admin/login", { password });
  return data;
}

// Get Dashboard Statistics
export async function getStats() {
  const { data } = await api.get("/api/admin/stats");
  return data;
}

// Get Users List (Paginated)
export async function getUsers(limit = 20, offset = 0, search = "") {
  const { data } = await api.get("/api/admin/users", {
    params: { limit, offset, search },
  });
  return data;
}

// Get Note Diagnoses (Paginated)
export async function getDiagnoses(limit = 20, offset = 0, search = "") {
  const { data } = await api.get("/api/admin/diagnoses", {
    params: { limit, offset, search },
  });
  return data;
}

// Get Video Analyses (Paginated)
export async function getVideoAnalyses(limit = 20, offset = 0, search = "") {
  const { data } = await api.get("/api/admin/video-analyses", {
    params: { limit, offset, search },
  });
  return data;
}

// Get Customer Feedbacks (Paginated)
export async function getFeedbacks(limit = 20, offset = 0) {
  const { data } = await api.get("/api/admin/feedbacks", {
    params: { limit, offset },
  });
  return data;
}
