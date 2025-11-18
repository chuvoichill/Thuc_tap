import { getStudents } from '../models/teacherModel.js';
import { getSelfAssessment_student, postSelfAssessment } from '../models/drlModel.js';

export const getAllStudents = async (req, res) => {
  const username = req.user?.username; // Lấy username từ req.user (authMiddleware hàm protectedRoute)
  const {term, class_code } = req.query || {};
  if (!username || !term) return res.status(400).json({ error: 'Thiếu thông tin!' });

  try {
    const rows = await getStudents(username, term, class_code );
    res.json(rows);
  } catch (err) {
    console.error('Lỗi ở getStudent(teacherController)', err);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

// GV xem phiếu DRL của 1 SV
export const getStudentAssessment = async (req, res) => {
  const { student_code, term } = req.query || {};

  if (!student_code || !term) {
    return res.status(400).json({ error: 'Không tìm thấy MSV hoặc học kì!!!' });
  }

  try {
    const rows = await getSelfAssessment_student(student_code, term);
    res.json(rows);
  } catch (err) {
    console.error('Lỗi getStudentAssessment (teacher)', err);
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};

// GV lưu điểm DRL cho 1 SV
export const saveStudentAssessment = async (req, res) => {
  const { student_code, term_code, items } = req.body || {};

  if (!student_code || !term_code || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Không tìm thấy MSV hoặc học kì!' });
  }

  try {
    const result = await postSelfAssessment(student_code, term_code, items);
    res.json(result);
  } catch (err) {
    console.error('Lỗi saveStudentAssessment (teacher)', err);
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};