export const MENUS = {
  student: [
    {
      key: "self",
      path: "/self-assessment",
      icon: "bi-ui-checks-grid",
      text: "Tự đánh giá",
    },
    {
      key: "self-history",
      path: "/history",
      icon: "bi-archive-fill",
      text: "Lịch sử đánh giá",
    }, // Đã sửa
  ],
  teacher: [
    {
      key: "view-students",
      path: "/teacher/students",
      icon: "bi-people",
      text: "SV các lớp phụ trách",
    },
  ],
  faculty: [
    {
      key: "view-classes",
      path: "/faculty/classes",
      icon: "bi-people",
      text: "Tổng hợp theo lớp",
    },
  ],
  union: [
    {
      key: "hsv-classes",
      path: "/hsv/classes",
      icon: "bi-people",
      text: "HSV – Xác nhận ĐTN/HSV",
    },
  ],
  hsv: [
    {
      key: "hsv-classes",
      path: "/hsv/classes",
      icon: "bi-people",
      text: "HSV – Xác nhận ĐTN/HSV",
    },
  ],
  admin: [
    {
      key: "view-faculties",
      path: "/admin/faculties",
      icon: "bi-building",
      text: "Tổng hợp theo khoa",
    },
    {
      key: "view-classes",
      path: "/admin/classes",
      icon: "bi-people",
      text: "Tổng hợp theo lớp",
    },
    {
      key: "view-students",
      path: "/admin/search",
      icon: "bi-binoculars",
      text: "Tìm & xem SV",
    },
    {
      key: "admin-criteria",
      path: "/admin/criteria",
      icon: "bi-sliders2",
      text: "Quản trị tiêu chí",
    },
    {
      key: "manage-groups",
      path: "/admin/groups/manage",
      icon: "bi bi-tags-fill",
      text: "Quản lý Nhóm TC",
    },
    {
      key: "manage-users",
      path: "/admin/users",
      icon: "bi-people-fill",
      text: "Quản lý Người dùng",
    },
    {
      key: "manage-classes",
      path: "/admin/classes/manage",
      icon: "bi-collection-fill",
      text: "Quản lý Lớp học",
    },
    {
      key: "manage-faculties",
      path: "/admin/faculties/manage",
      icon: "bi-buildings-fill",
      text: "Quản lý Khoa",
    },
    // --- DÒNG QUAN TRỌNG ĐÂY ---
    {
      key: "manage-terms",
      path: "/admin/terms",
      icon: "bi-calendar-event-fill",
      text: "Quản lý Học kỳ",
    },
    // --- HẾT ---
  ],
};
