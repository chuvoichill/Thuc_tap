// backend/controllers/facultyController.js
import { listClassesByFacultyAndTerm, isClassInFaculty, listStudentsInClassForTerm, approveClassByFaculty, checkEditAccess } from '../models/facultyModel.js';
import { postSelfAssessment } from '../models/drlModel.js';

// Lấy danh sách lớp của khoa trong một học kì
export const getClasses = async (req, res) => {
  const faculty_id = req.user?.faculty_id;
  const { term } = req.query || {};
  
  if (!faculty_id || !term) {
      return res.status(400).json({ error: 'Lỗi hệ thống, không có mã khoa và học kỳ' });
    }  
  try {
    const rows = await listClassesByFacultyAndTerm(faculty_id, String(term).trim());
    res.json(rows);
  } catch (err) {
    console.error('lỗi ở controller Faculty GetClasses!', err);
    res.status(500).json({ error: 'Lỗi hệ thống!' });
  }
};

// Lấy danh sách SV của lớp trong một term 
export const getClassStudents = async (req, res) => {
  const faculty_id = req.user?.faculty_id;
  const { class_code, term } = req.query || {};
  
  if (!class_code || !term || !faculty_id) {
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }

  try {
    const code = String(class_code).trim();
    const inFaculty = await isClassInFaculty(code, faculty_id);
    if (!inFaculty) {
      return res.status(403).json({ error: 'Lớp không có trong khoa!' });
    }

    const rows = await listStudentsInClassForTerm(code, String(term).trim());
    res.json(rows);
  } catch (err) {
     console.error('lỗi ở getClassStudents (facultycontroller):', err);
     res.status(500).json({ error: 'Lỗi hệ thống!' });
  }
};

// Khoa chỉnh sửa điểm sinh viên
export const updateStudentScore = async (req, res) => {
  const faculty_id = req.user?.faculty_id;
  const user_id = req.user?.user_id; 
  const { student_code, term_code, items, note } = req.body;

  if (!faculty_id || !student_code || !term_code || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }

  try {
    // 1. Kiểm tra quyền (thuộc khoa + giáo viên chưa duyệt + chưa bị Admin khóa) 
    const { in_faculty, is_locked, is_teacher_approved } = await checkEditAccess(student_code, faculty_id, term_code);
    
    if (!in_faculty) {
      return res.status(403).json({ error: 'Sinh viên không thuộc khoa này' });
    }
    if (is_locked) {
      return res.status(403).json({ error: 'Học kỳ này đã được Admin duyệt, Khoa không thể chỉnh sửa.' });
    }
    if (!is_teacher_approved) {
      return res.status(400).json({ error: 'Giáo viên chưa chốt điểm lớp này, Khoa chưa thể chỉnh sửa.' });
    }

    // 2. Lưu điểm
    // Hàm postSelfAssessment sẽ cập nhật bảng drl.self_assessment và drl.assessment_history
    await postSelfAssessment(student_code, term_code, items, user_id, 'faculty', note);

    res.json({ message: 'Cập nhật điểm thành công' });
  } catch (err) {
    console.error('Lỗi ở updateStudentScore (facultyController):', err);
    res.status(500).json({ error: 'Lỗi hệ thống!' });
  }
};

// Khoa duyệt lớp
export const approveClass = async (req, res) => {
  const faculty_id = req.user?.faculty_id;
  const { class_code, term } = req.body; 

  if (!faculty_id || !class_code || !term) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (class_code, term)' });
  }

  try {
    await approveClassByFaculty(String(class_code).trim(), faculty_id, String(term).trim());
    res.json({ message: 'Đã duyệt lớp thành công!' });
  } catch (err) {
    if (err.message === 'CLASS_NOT_FOUND_OR_NOT_IN_FACULTY') {
      return res.status(403).json({ error: 'Lớp không tồn tại hoặc không thuộc khoa này' });
    }
    if (err.message === 'TEACHER_NOT_APPROVED_YET') {
      return res.status(400).json({ error: 'Giáo viên chủ nhiệm chưa duyệt lớp này, Khoa chưa thể duyệt.' });
    }
    if (err.message === 'CLASS_LOCKED_BY_ADMIN') {
      return res.status(400).json({ error: 'Lớp này đã được Admin duyệt, Khoa không thể thao tác.' });
    }
    console.error('Lỗi ở approveClass (facultyController):', err);
    res.status(500).json({ error: 'Lỗi hệ thống!' });
  }
};
