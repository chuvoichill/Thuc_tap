import { getStudents, getStudentsNot,postLockAss,postStudentAllNotAssessment , getAllStudentsInClass} from '../models/teacherModel.js';
import { getSelfAssessment_student, postSelfAssessment } from '../models/drlModel.js';

export const getAllStudents = async (req, res) => {
  const teacher_id = req.user?.teacher_id; // Lấy teacher_id từ req.user (authMiddleware hàm protectedRoute)
  const {term} = req.query || {};
  if (!teacher_id || !term) return res.status(400).json({ error: 'Thiếu thông tin!' });

  try {
    const rows = await getStudents(teacher_id, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getStudent', error);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

export const getAllStudentsNot = async (req,res) => {
  const teacher_id = req.user?.teacher_id;
  const {term} = req.query || {};
  if (!teacher_id || !term) return res.status(400).json({ error: 'Thiếu thông tin!' });

  try {
    const rows = await getStudentsNot(teacher_id, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getStudent', error);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

//Tự đánh giá cho sinh viên
export const postStudentNotAss = async (req,res) => {
  const teacher_id = req.user?.teacher_id; 
  const { term } = req.query || {};
  const { user_id } = req.user;
  if (!teacher_id || !term) {
    return res.status(400).json({ error: 'Thiếu dữ liệu đầu vào' });
  }
  
  try {
    const result = await postStudentAllNotAssessment (teacher_id, term, user_id);
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

// Lấy tất cả sinh viên trong lớp (cho chức năng chọn lớp trưởng)
export const getAllStudentsInClassController = async (req, res) => {
  const teacher_id = req.user?.teacher_id;
  const { term } = req.query || {};
  
  if (!teacher_id || !term) {
    return res.status(400).json({ error: 'Thiếu thông tin!' });S
  }

  try {
    const rows = await getAllStudentsInClass(teacher_id, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getAllStudentsInClass', error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

//Duyet toan bo SV 
export const postAcceptStudent = async (req,res) =>{
  const { term } = req.body;
  const { teacher_id, user_id } = req.user;

  if (!term) return res.status(400).json({ message: 'Không tìm thấy học kì' });

  try {
    const rows = await postAccept(teacher_id, term, user_id);
    const lock = await postLockAss(teacher_id, term, user_id);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở acceptAssessment', error);
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};
//Khoa sinh vien 
