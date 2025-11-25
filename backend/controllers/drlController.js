import { getCriteria, getHistoryAss, postSelfAssessment } from '../models/drlModel.js';
import { getSelfAssessment_student } from '../models/drlModel.js';

export const getCriteriaController = async (req, res) => {
  const { term } = req.query;
  if (!term) return res.status(400).json({ error: "Không tìm thấy học kì" });

  try {
    const rows = await getCriteria(term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getCriteriaController nè!',error);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

export const getSelfAssessment = async (req, res) => {
    const { term } = req.query || {};
    const {role} = req.user; // Lấy role từ req.user (authMiddleware hàm protectedRoute)
    
    let student_code;
    if (role === 'student') {
      student_code = req.user?.student_code; // Lấy student_code từ req.user (authMiddleware hàm protectedRoute)
    } else {
      student_code = req.query.student_code; // Lấy student_code từ query param nếu không phải sinh viên
    }
    
    if (!student_code || !term) 
    return res.status(400).json({ error: 'Không tìm thấy MSV hoặc học kì!!!' });

    try {
        const rows = await getSelfAssessment_student(student_code,term);
        res.json(rows);
    } catch (error) {
        console.error('Lỗi ở getSelfAssessment!', error);
        res.status(500).send({message: "Lỗi hệ thống"});
    }
};

export const saveSelfAssessment = async (req, res) => {
  const { term_code, items } = req.body || {};
  const {role} = req.user; // Lấy role từ req.user (authMiddleware hàm protectedRoute)

  let student_code;
  if(role === 'student'){
    student_code = req.user?.student_code; // Lấy student_code từ req.user (authMiddleware hàm protectedRoute)
  }
  else {
    student_code = req.body.student_code; // Lấy student_code từ body nếu không phải sinh viên
  }

  if (!student_code || !term_code || !Array.isArray(items)) {
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào" });
  }

   try {
    const result = await postSelfAssessment(student_code, term_code, items);
    return res.json(result);
  } catch (error) {
    if (error.message === "Student_404") {
      return res.status(404).json({ error: "Không tìm thấy sinh viên!" });
    }

    console.error(error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

export const getStudentHistory = async (req, res) => {
  let student_code = req.query?.student_code; // Admin/Teacher truyền qua query
  
  if (!student_code) {
    // Nếu không có trong query, lấy từ token (sinh viên tự xem)
    student_code = req.user?.student_code;
  }

  if (!student_code) {
    return res.status(400).json({ error: 'Không tìm thấy MSV' });
  }

  try {
    const rows = await getHistoryAss(student_code);
    res.json(rows);
  } catch (error) {
    console.error('Không tìm thấy lịch sử đánh giá', error);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};