export const roleVN = (r) => {
  switch (r) {
    case 'student': return 'Sinh viên';
    case 'teacher': return 'Giáo viên/CVHT';
    case 'faculty': return 'Khoa';
    case 'union':
    case 'hsv': return 'Hội Sinh Viên';
    case 'admin': return 'Trường';
    default: return r;
  }
};