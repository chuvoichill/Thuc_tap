import pool from '../db.js';
import { toNum} from '../utils/helpers.js';
import { getCriteria, postSelfAssessment } from '../models/drlModel.js';
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
    const { student_code, term } = req.query || {};
    if (!student_code || !term) return res.status(400).json({ error: 'Không tìm thấy MSV hoặc học kì!' });

    try {
        // Lấy dữ liệu tự đánh giá
        const rows = await getSelfAssessment_student(student_code,term);
        
        res.json(rows);
    } catch (error) {
        console.error('Lỗi ở getSelfAssessment!', error);
        res.status(500).send({message: "Lỗi hệ thống"});
    }
};

export const saveSelfAssessment = async (req, res) => {
  const { student_code, term_code, items } = req.body || {};

  if (!student_code || !term_code || !Array.isArray(items)) {
    return res.status(400).json({ error: "Không tìm thấy MSV hoặc học kì!" });
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


export const getStudentHistory = async (req, res, next) => {
  const { student_code } = req.query; // Lấy student_code từ query param

  if (!student_code) {
    return res.status(400).json({ error: 'missing_student_code' });
  }

  try {
    // Truy vấn bảng drl.term_score
    // JOIN với ref.student để lọc theo student_code
    // JOIN với ref.term để có thể sắp xếp theo năm/học kỳ
    const { rows } = await pool.query(
      `
      SELECT
        ts.term_code,      -- Mã học kỳ
        ts.total_score,    -- Tổng điểm kỳ đó
        ts.rank            -- Xếp loại kỳ đó
      FROM drl.term_score ts
      JOIN ref.student s ON ts.student_id = s.id -- Join để lấy student_id
      JOIN ref.term t ON ts.term_code = t.code    -- Join để lấy thông tin năm/kỳ
      WHERE s.student_code = $1                   -- Lọc theo student_code
      ORDER BY
        t.year DESC,      -- Sắp xếp: Năm học mới nhất lên đầu
        t.semester DESC   -- Sắp xếp: Học kỳ lớn hơn lên đầu (HK2 > HK1)
      `,
      [student_code.trim()] // Truyền student_code vào query
    );

    // Trả về kết quả là một mảng các object
    res.json(rows);

  } catch (err) {
    console.error('Get Student History Error:', err);
    next(err); // Chuyển lỗi cho error handler chung
  }
};