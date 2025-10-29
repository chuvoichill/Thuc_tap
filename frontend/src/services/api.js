import axios from 'axios';

// Lấy API_BASE từ file .env
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Cho phép gửi cookie
});

// Interceptor: Tự động thêm token vào header
api.interceptors.request.use((config) => {
  try {
    const authData = localStorage.getItem('auth');
    if (authData) {
      const auth = JSON.parse(authData);
      if (auth.token) {
        config.headers['Authorization'] = `Bearer ${auth.token}`;
      }
    }
  } catch (e) {
    console.error("Could not parse auth token", e);
  }
  return config;
});

// Interceptor: Xử lý lỗi tập trung
api.interceptors.response.use(
  (response) => response.data, // Chỉ trả về 'data'
  (error) => {
    // Ưu tiên message lỗi từ server
    const msg = error.response?.data?.error || 
                error.response?.data?.message || 
                error.message;
    return Promise.reject(new Error(msg));
  }
);

export default api;