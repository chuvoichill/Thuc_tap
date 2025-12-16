import pool from '../db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload minh chứng cho một tiêu chí
export const uploadEvidence = async (req, res) => {
  try {
    const { student_code, term_code, criterion_id } = req.body;
    const uploaded_by = req.user?.user_id || req.user?.student_id || req.user?.teacher_id; // Lấy user_id từ JWT
    
    if (!student_code || !term_code || !criterion_id) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    if (!uploaded_by) {
      return res.status(401).json({ error: 'Chưa xác thực. Vui lòng đăng nhập lại.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Chưa chọn file' });
    }

    // Lấy student_id
    const studentResult = await pool.query(
      'SELECT id FROM ref.students WHERE student_code = $1',
      [student_code]
    );
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sinh viên' });
    }
    
    const student_id = studentResult.rows[0].id;

    // Tìm self_assessment_id
    const assessmentResult = await pool.query(
      `SELECT id FROM drl.self_assessment 
       WHERE student_id = $1 AND term_code = $2 AND criterion_id = $3`,
      [student_id, term_code, criterion_id]
    );

    let self_assessment_id;
    if (assessmentResult.rows.length === 0) {
      // Tạo mới self_assessment nếu chưa có
      const newAssessment = await pool.query(
        `INSERT INTO drl.self_assessment (student_id, term_code, criterion_id, self_score, updated_at)
         VALUES ($1, $2, $3, 0, now()) RETURNING id`,
        [student_id, term_code, criterion_id]
      );
      self_assessment_id = newAssessment.rows[0].id;
    } else {
      self_assessment_id = assessmentResult.rows[0].id;
    }

    // Lưu thông tin các file vào database (theo schema có sẵn)
    const uploadedFiles = [];
    for (const file of req.files) {
      const result = await pool.query(
        `INSERT INTO drl.assessment_evidence 
         (self_assessment_id, file_url, file_type, uploaded_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          self_assessment_id,
          file.filename, // Lưu tên file đã rename vào file_url
          file.mimetype, // Lưu mime type vào file_type
          uploaded_by
        ]
      );
      uploadedFiles.push({
        ...result.rows[0],
        original_name: file.originalname,
        file_size: file.size
      });
    }

    res.status(201).json({
      message: 'Upload thành công',
      files: uploadedFiles
    });

  } catch (error) {
    console.error('Lỗi upload minh chứng:', error);
    res.status(500).json({ error: 'Lỗi server khi upload file' });
  }
};

// Lấy danh sách minh chứng của sinh viên cho một tiêu chí
export const getEvidenceByAssessment = async (req, res) => {
  try {
    const { student_code, term_code, criterion_id } = req.query;

    if (!student_code || !term_code || !criterion_id) {
      return res.status(400).json({ error: 'Thiếu thông tin truy vấn' });
    }

    const result = await pool.query(
      `SELECT e.id, e.self_assessment_id, e.file_url, e.file_type, e.uploaded_by, e.created_at,
              sa.criterion_id
       FROM drl.assessment_evidence e
       JOIN drl.self_assessment sa ON e.self_assessment_id = sa.id
       JOIN ref.students s ON sa.student_id = s.id
       WHERE s.student_code = $1 
         AND sa.term_code = $2 
         AND sa.criterion_id = $3
       ORDER BY e.created_at DESC`,
      [student_code, term_code, criterion_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Lỗi lấy danh sách minh chứng:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

// Xóa file minh chứng
export const deleteEvidence = async (req, res) => {
  try {
    const { id } = req.params;

    // Lấy thông tin file trước khi xóa
    const fileResult = await pool.query(
      'SELECT file_url FROM drl.assessment_evidence WHERE id = $1',
      [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy file' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'evidence', fileResult.rows[0].file_url);

    // Xóa file khỏi database
    await pool.query('DELETE FROM drl.assessment_evidence WHERE id = $1', [id]);

    // Xóa file vật lý
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Đã xóa file minh chứng' });
  } catch (error) {
    console.error('Lỗi xóa minh chứng:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa file' });
  }
};

// Serve file ảnh (cho phép xem ảnh)
export const serveEvidence = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', 'evidence', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File không tồn tại' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Lỗi serve file:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};
