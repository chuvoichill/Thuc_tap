import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spinner, Container } from 'react-bootstrap'; // Import Spinner và Container
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
import SearchStudentsPage from './pages/admin/SearchStudentsPage';
import AdminCriteriaPage from './pages/admin/AdminCriteriaPage';
import ManageUsersPage from './pages/admin/ManageUsersPage';
import ManageClassesPage from './pages/admin/ManageClassesPage';
import ManageFacultiesPage from './pages/admin/ManageFacultiesPage';
import ManageTermsPage from './pages/admin/ManageTermsPage';
import ManageGroupsPage from './pages/admin/ManageGroupsPage';

// Component bảo vệ Route: Chỉ cho phép truy cập nếu đã đăng nhập
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Component định nghĩa các Routes chính của ứng dụng
function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  // Hàm xác định trang chủ mặc định dựa trên vai trò người dùng
  const getHomeRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'student': return '/self-assessment';
      case 'teacher': return '/teacher/students';
      case 'faculty': return '/faculty/classes';
      case 'hsv':
      case 'union':
        return '/hsv/classes';
      case 'admin':
        return '/admin/faculties';
      default: return '/';
    }
  };

  // Cấu hình các Routes sử dụng react-router-dom
  return (
    <Routes>
      <Route path="/login" element={
        !isAuthenticated ? <LoginPage /> : <Navigate to={getHomeRoute()} />
      } />

      <Route
        path="/"
        element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}
      >
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
        <Route path="admin/search" element={<SearchStudentsPage />} />
        <Route path="admin/users" element={<ManageUsersPage />} />
        <Route path="admin/classes/manage" element={<ManageClassesPage />} />
        <Route path="admin/faculties/manage" element={<ManageFacultiesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

// Component App chính
function App() {
  const { loading } = useAuth();

  // Thay thế spinner Bootstrap thuần bằng component Spinner của React-Bootstrap
  if (loading) {
    return (
      // Container/div bọc ngoài để căn giữa
      <Container fluid className="vh-100 d-flex justify-content-center align-items-center">
        <Spinner animation="border" variant="success" role="status" />
      </Container>
    );
  }

  // Render bộ định tuyến khi đã sẵn sàng
  return <AppRoutes />;
}

export default App;