import pool from '../db.js';
import { getStudentClass } from '../models/classLeaderModel.js';

export const getStudentsLeader = async (req, res) => {
  const username = req.user?.username; // Lấy username từ req.user (authMiddleware hàm protectedRoute)
  const {term} = req.query || {};
  if (!username || !term) return res.status(400).json({ error: 'Thiếu thông tin!' });

  try {
    const rows = await getStudentClass(username, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getStudentClass', error);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};
/**
 * POST /api/teacher/class-leader/assign
 */
export const assignClassLeader = async (req, res) => {
  const { student_code, class_code } = req.body;
  const teacher_username = req.user?.username; // Giáo viên đang đăng nhập

  if (!student_code || !class_code) {
    return res.status(400).json({ error: 'Thiếu thông tin student_code hoặc class_code' });
  }

  try {
    // 1. Kiểm tra giáo viên có phải là GVCN của lớp này không
    const classCheck = await pool.query(
      `SELECT c.id, c.class_code, t.teacher_code
       FROM ref.classes c
       JOIN ref.teachers t ON c.teacher_id = t.id
       WHERE c.class_code = $1 AND t.teacher_code = $2`,
      [class_code, teacher_username]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Bạn không phải GVCN của lớp này' });
    }

    const class_id = classCheck.rows[0].id;

    // 2. Kiểm tra sinh viên có thuộc lớp này không
    const studentCheck = await pool.query(
      `SELECT id FROM ref.students 
       WHERE student_code = $1 AND class_id = $2`,
      [student_code, class_id]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Sinh viên không thuộc lớp này' });
    }

    const student_id = studentCheck.rows[0].id;

    // 3. Bỏ chỉ định lớp trưởng cũ (nếu có)
    await pool.query(
      `UPDATE ref.students 
       SET is_class_leader = FALSE, updated_at = NOW()
       WHERE class_id = $1 AND is_class_leader = TRUE`,
      [class_id]
    );

    // 4. Chỉ định lớp trưởng mới
    await pool.query(
      `UPDATE ref.students 
       SET is_class_leader = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [student_id]
    );

    res.json({ 
      message: 'Đã chỉ định lớp trưởng thành công',
      student_code,
      class_code
    });

  } catch (error) {
    console.error('Lỗi khi chỉ định lớp trưởng:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

/**
 * Giáo viên bỏ chỉ định lớp trưởng
 * POST /api/teacher/class-leader/remove
 */
export const removeClassLeader = async (req, res) => {
  const { class_code } = req.body;
  const teacher_username = req.user?.username;

  if (!class_code) {
    return res.status(400).json({ error: 'Thiếu thông tin class_code' });
  }

  try {
    // Kiểm tra giáo viên có phải GVCN không
    const classCheck = await pool.query(
      `SELECT c.id FROM ref.classes c
       JOIN ref.teachers t ON c.teacher_id = t.id
       WHERE c.class_code = $1 AND t.teacher_code = $2`,
      [class_code, teacher_username]
    );

    if (classCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Bạn không phải GVCN của lớp này' });
    }

    const class_id = classCheck.rows[0].id;

    // Bỏ chỉ định lớp trưởng
    const result = await pool.query(
      `UPDATE ref.students 
       SET is_class_leader = FALSE, updated_at = NOW()
       WHERE class_id = $1 AND is_class_leader = TRUE
       RETURNING student_code`,
      [class_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Lớp này chưa có lớp trưởng' });
    }

    res.json({ 
      message: 'Đã bỏ chỉ định lớp trưởng',
      student_code: result.rows[0].student_code
    });

  } catch (error) {
    console.error('Lỗi khi bỏ chỉ định lớp trưởng:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

/**
 * Lấy thông tin lớp trưởng của lớp
 * GET /api/teacher/class-leader?class_code=xxx
 */
export const getClassLeader = async (req, res) => {
  const { class_code } = req.query;
  const teacher_username = req.user?.username;

  if (!class_code) {
    return res.status(400).json({ error: 'Thiếu class_code' });
  }

  try {
    const result = await pool.query(
      `SELECT s.student_code, s.name, s.is_class_leader
       FROM ref.students s
       JOIN ref.classes c ON s.class_id = c.id
       JOIN ref.teachers t ON c.teacher_id = t.id
       WHERE c.class_code = $1 AND t.teacher_code = $2 AND s.is_class_leader = TRUE`,
      [class_code, teacher_username]
    );

    if (result.rows.length === 0) {
      return res.json({ class_leader: null });
    }

    res.json({ class_leader: result.rows[0] });

  } catch (error) {
    console.error('Lỗi khi lấy thông tin lớp trưởng:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

/**
 * Lớp trưởng kiểm tra quyền của mình
 * GET /api/class-leader/check
 */
export const checkClassLeaderRole = async (req, res) => {
  const student_code = req.user?.student_code;

  if (!student_code) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  try {
    const result = await pool.query(
      `SELECT is_class_leader, c.class_code, c.name as class_name
       FROM ref.students s
       JOIN ref.classes c ON s.class_id = c.id
       WHERE s.student_code = $1`,
      [student_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sinh viên' });
    }

    const student = result.rows[0];
    res.json({ 
      is_class_leader: student.is_class_leader,
      class_code: student.class_code,
      class_name: student.class_name
    });

  } catch (error) {
    console.error('Lỗi khi kiểm tra quyền lớp trưởng:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

/**
 * Lớp trưởng lấy danh sách sinh viên trong lớp của mình
 * GET /api/class-leader/students?term=xxx
 */
export const getClassStudents = async (req, res) => {
  const { term } = req.query;
  const student_code = req.user?.student_code;

  if (!term || !student_code) {
    return res.status(400).json({ error: 'Thiếu thông tin term hoặc student_code' });
  }

  try {
    // 1. Kiểm tra là lớp trưởng và lấy class_id
    const leaderCheck = await pool.query(
      `SELECT class_id, is_class_leader 
       FROM ref.students 
       WHERE student_code = $1`,
      [student_code]
    );

    if (leaderCheck.rows.length === 0 || !leaderCheck.rows[0].is_class_leader) {
      return res.status(403).json({ error: 'Bạn không phải lớp trưởng' });
    }

    const class_id = leaderCheck.rows[0].class_id;

    // 2. Lấy danh sách sinh viên trong lớp
    const studentsResult = await pool.query(
      `SELECT 
        s.student_code,
        s.name,
        s.is_class_leader,
        COALESCE(SUM(sa.self_score), 0) as total_score,
        COUNT(DISTINCT sa.criterion_id) as assessed_criteria
       FROM ref.students s
       LEFT JOIN drl.self_assessment sa ON s.id = sa.student_id AND sa.term_code = $1
       WHERE s.class_id = $2
       GROUP BY s.id, s.student_code, s.name, s.is_class_leader
       ORDER BY s.name`,
      [term, class_id]
    );

    res.json(studentsResult.rows);

  } catch (error) {
    console.error('Lỗi khi lấy danh sách sinh viên:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

