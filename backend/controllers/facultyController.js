// backend/controllers/facultyController.js
import {listStudentsByFacultyAndTerm, approveClassByFaculty, checkEditAccess, checkFacultyLocked} from '../models/facultyModel.js';
import { postSelfAssessment } from '../models/drlModel.js';

//lấy toàn bộ sinh viên thuộc các lớp của khoa trong một học kỳ
export const getAllFacultyStudents = async (req, res) => {
  console.log('getAllFacultyStudents called with query:');
  const faculty_id = req.user?.faculty_id;
  const { term } = req.query || {};
  if (!faculty_id || !term) {
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }
  try {
    const rows = await listStudentsByFacultyAndTerm(faculty_id, String(term).trim());
    res.json(rows);
  } catch (err) {
    console.error('lỗi ở getAllFacultyStudents (facultycontroller):', err);  
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
    // 1. Kiểm tra quyền (thuộc khoa + giáo viên chưa duyệt) 
    const { in_faculty, is_teacher_approved, is_faculty_approved } = await checkEditAccess(student_code, faculty_id, term_code);
    
    if (!in_faculty) {
      return res.status(403).json({ error: 'Sinh viên không thuộc khoa này' });
    }
    if (!is_teacher_approved) {
      return res.status(400).json({ error: 'Giáo viên chưa chốt điểm lớp này, Khoa chưa thể chỉnh sửa.' });
    }
    if (is_faculty_approved) {
      return res.status(403).json({ error: 'Khoa đã duyệt lớp này, không thể chỉnh sửa thêm.' });
    }

    //2. cập nhật bảng drl.self_assessment và drl.assessment_history
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
  const user_id = req.user?.user_id;
  const { class_code, term } = req.body; 

  if (!faculty_id) {
    console.log('Missing faculty_id. req.user:', req.user);
    return res.status(400).json({ error: 'Tài khoản không có quyền Khoa hoặc thiếu faculty_id' });
  }
  
  if (!class_code || !term) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (class_code, term)' });
  }

  try {
    await approveClassByFaculty(String(class_code).trim(), faculty_id, String(term).trim(), user_id);
    res.json({ message: 'Đã duyệt lớp thành công!' });
  } catch (err) {
    if (err.message === 'CLASS_NOT_FOUND_OR_NOT_IN_FACULTY') {
      return res.status(403).json({ error: 'Lớp không tồn tại hoặc không thuộc khoa này' });
    }
    if (err.message === 'TEACHER_NOT_APPROVED_YET') {
      return res.status(400).json({ error: 'Giáo viên chủ nhiệm chưa duyệt lớp này, Khoa chưa thể duyệt.' });
    }
    if (err.message === 'FACULTY_ALREADY_APPROVED') {
      return res.status(400).json({ error: 'Khoa đã duyệt, không thể duyệt thêm!' });
    }
    console.error('Lỗi ở approveClass (facultyController):', err);
    res.status(500).json({ error: 'Lỗi hệ thống!' });
  }
};

// Kiểm tra trạng thái khóa của khoa
export const getFacultyLockStatus = async (req, res) => {
  const { faculty_id } = req.user;
  const { class_code, term } = req.query;

  if (!class_code || !term) {
    return res.status(400).json({ message: 'Thiếu thông tin' });
  }

  try {
    const isLocked = await checkFacultyLocked(faculty_id, class_code, term);
    res.json({ isLocked });
  } catch (error) {
    console.error('Lỗi ở getFacultyLockStatus', error);
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};
