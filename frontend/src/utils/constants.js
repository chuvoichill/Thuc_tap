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
    {
      key: "manage-class-leader",
      path: "/teacher/class-leader",
      icon: "bi-star",
      text: "Quản lý lớp trưởng",
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
  admin: [
    {
      key: "view-faculties",
      path: "/admin/faculties",
      icon: "bi-building",
      text: "Tổng hợp theo khoa",
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
      text: "Quản lý tiêu chí",
    },
    {
      key: "manage-groups",
      path: "/admin/groups/manage",
      icon: "bi bi-tags-fill",
      text: "Quản lý nhóm tiêu chí",
    },
    // --- DÒNG QUAN TRỌNG ĐÂY ---
    {
      key: "manage-terms",
      path: "/admin/terms",
      icon: "bi-calendar-event-fill",
      text: "Quản lý học kỳ",
    },
    // --- HẾT ---
  ],
};
