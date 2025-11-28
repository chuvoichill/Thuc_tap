import { getStudents, getStudentsNot,postStudentAllNotAssessment } from '../models/teacherModel.js';
import { getSelfAssessment_student, postSelfAssessment } from '../models/drlModel.js';

export const getAllStudents = async (req, res) => {
  const username = req.user?.username; // Lấy username từ req.user (authMiddleware hàm protectedRoute)
  const {term} = req.query || {};
  if (!username || !term) return res.status(400).json({ error: 'Thiếu thông tin!' });

  try {
    const rows = await getStudents(username, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getStudent', error);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

export const getAllStudentsNot = async (req,res) => {
  const username = req.user?.username;
  const {term} = req.query || {};
  if (!username || !term) return res.status(400).json({ error: 'Thiếu thông tin!' });

  try {
    const rows = await getStudentsNot(username, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getStudent', error);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

//Tự đánh giá cho sinh viên
export const postStudentNotAss = async (req,res) => {
  const {username, term} = req.query || {};
  console.log(username,term)
  if (!username || !term) {
    return res.status(400).json({ error: 'Thiếu dữ liệu đầu vào' });
  }
  
  try {
    const result = await postStudentAllNotAssessment (username, term);
    res.json(result);
  } catch (error) {
    console.error('Lỗi postStudentNotAss (teacher)', error);
    res.status(500).json({ message: 'Lỗi hệ thống' });
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

// GV lưu điểm DRL cho 1  
export const saveStudentAssessment = async (req, res) => {
  const { student_code, term_code, items } = req.body || {};

  if (!student_code || !term_code || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Thiếu dữ liệu đầu vào' });
  }

  try {
    const result = await postSelfAssessment(student_code, term_code, items);
    res.json(result);
  } catch (err) {
    console.error('Lỗi saveStudentAssessment (teacher)', err);
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};