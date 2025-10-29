import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuth from './hooks/useAuth';
import DashboardLayout from './layout/DashboardLayout';
import LoginPage from './pages/LoginPage';
// Student Pages
import SelfAssessmentPage from './pages/student/SelfAssessmentPage';
import AssessmentHistoryPage from './pages/student/AssessmentHistoryPage';
import SelfHistoryPage from './pages/student/SelfHistoryPage';
// Teacher Pages
import ViewStudentsPage from './pages/teacher/ViewStudentsPage';
// Faculty Pages
import ViewClassesPage from './pages/faculty/ViewClassesPage';
// HSV Pages
import ViewHSVClassesPage from './pages/hsv/ViewHSVClassesPage';
// Admin Pages
import ViewFacultiesPage from './pages/admin/ViewFacultiesPage';
import ViewAllClassesPage from './pages/admin/ViewAllClassesPage';
// --- CÁC DÒNG NÀY ĐÃ ĐƯỢC BỎ COMMENT ---
import SearchStudentsPage from './pages/admin/SearchStudentsPage'; // Trang tìm SV
import AdminCriteriaPage from './pages/admin/AdminCriteriaPage';   // Trang quản trị tiêu chí
import ManageUsersPage from './pages/admin/ManageUsersPage';     // Trang quản lý người dùng
import ManageClassesPage from './pages/admin/ManageClassesPage';   // Trang quản lý lớp
import ManageFacultiesPage from './pages/admin/ManageFacultiesPage'; // Trang quản lý khoa
// --- HẾT ---
import ManageTermsPage from './pages/admin/ManageTermsPage';       // Trang quản lý học kỳ

import ManageGroupsPage from './pages/admin/ManageGroupsPage'; // Trang quản lý nhóm TC

// Component bảo vệ Route: Chỉ cho phép truy cập nếu đã đăng nhập
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth(); // Lấy trạng thái đăng nhập từ context
  // Nếu đã đăng nhập, hiển thị component con (children), ngược lại chuyển về trang login
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Component định nghĩa các Routes chính của ứng dụng
function AppRoutes() {
  const { isAuthenticated, user } = useAuth(); // Lấy trạng thái đăng nhập và thông tin user

  // Hàm xác định trang chủ mặc định dựa trên vai trò người dùng
  const getHomeRoute = () => {
    if (!user) return '/login'; // Nếu chưa đăng nhập -> login
    switch (user.role) {
      case 'student': return '/self-assessment'; // SV -> Tự đánh giá
      case 'teacher': return '/teacher/students'; // GV -> Xem SV phụ trách
      case 'faculty': return '/faculty/classes'; // Khoa -> Xem lớp của khoa
      case 'hsv':
      case 'union':
        return '/hsv/classes'; // HSV/Đoàn -> Xem lớp (để duyệt 2.1)
      case 'admin':
        return '/admin/faculties'; // Admin -> Tổng hợp theo khoa
      default: return '/'; // Mặc định (ít khi xảy ra)
    }
  };

  // Cấu hình các Routes sử dụng react-router-dom
  return (
    <Routes>
      {/* Route Đăng nhập: chỉ truy cập được khi chưa đăng nhập */}
      <Route path="/login" element={
        !isAuthenticated ? <LoginPage /> : <Navigate to={getHomeRoute()} />
      } />

      {/* Các trang bên trong Dashboard: yêu cầu đăng nhập (sử dụng ProtectedRoute) */}
      <Route
        path="/"
        element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} // Bọc layout bằng ProtectedRoute
      >
        {/* Route mặc định ('/') -> chuyển hướng về trang chủ theo role */}
        <Route index element={<Navigate to={getHomeRoute()} />} />

        {/* Student Routes */}
        <Route path="self-assessment" element={<SelfAssessmentPage />} />
        <Route path="history" element={<AssessmentHistoryPage />} />
        <Route path="self-history/:termCode" element={<SelfHistoryPage />} />

        {/* Teacher Routes */}
        <Route path="teacher/students" element={<ViewStudentsPage />} />

        {/* Faculty Routes */}
        <Route path="faculty/classes" element={<ViewClassesPage />} />

        {/* HSV Routes */}
        <Route path="hsv/classes" element={<ViewHSVClassesPage />} />

        {/* Admin Routes */}
        <Route path="admin/faculties" element={<ViewFacultiesPage />} />
        <Route path="admin/classes" element={<ViewAllClassesPage />} />
        <Route path="admin/criteria" element={<AdminCriteriaPage />} />
        <Route path="admin/groups/manage" element={<ManageGroupsPage />} />
        <Route path="admin/terms" element={<ManageTermsPage />} />
        {/* --- CÁC ROUTE NÀY ĐÃ ĐƯỢC BỎ COMMENT --- */}
        <Route path="admin/search" element={<SearchStudentsPage />} />
        <Route path="admin/users" element={<ManageUsersPage />} />
        <Route path="admin/classes/manage" element={<ManageClassesPage />} />
        <Route path="admin/faculties/manage" element={<ManageFacultiesPage />} />
        {/* --- HẾT --- */}

      </Route>

      {/* Route bắt lỗi 404 (bất kỳ đường dẫn nào không khớp) -> chuyển về trang chủ */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

// Component App chính, xử lý trạng thái loading ban đầu khi khôi phục session
function App() {
  const { loading } = useAuth(); // Lấy state loading từ AuthContext

  // Hiển thị spinner cho đến khi AuthContext xác định xong trạng thái đăng nhập
  if (loading) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Render bộ định tuyến khi đã sẵn sàng
  return <AppRoutes />;
}

export default App; // Export component App