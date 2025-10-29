const pool = require('../db');

// Helper kiểm tra quyền Khoa
const checkFacultyAccess = async (username) => {
    const u = await pool.query(
        `SELECT faculty_code FROM auth.user_account
         WHERE username = $1 AND role_code = 'faculty' AND is_active = TRUE`,
        [username]
    );
    if (!u.rowCount || !u.rows[0].faculty_code) {
        return null; // Không có quyền hoặc không tìm thấy faculty_code
    }
    return u.rows[0].faculty_code;
};

exports.getClasses = async (req, res, next) => {
  const { username, term } = req.query || {};
  if (!username || !term) return res.status(400).json({ error: 'missing_params' });

  try {
    const faculty_code = await checkFacultyAccess(username.trim());
    if (!faculty_code) {
         return res.status(403).json({ error: 'forbidden_or_not_faculty' });
    }


    // Query tính toán thông tin lớp (có thể tối ưu bằng cách join ít hơn)
     const { rows } = await pool.query(`
       SELECT
         c.code AS class_code, c.name AS class_name,
         COUNT(s.id) AS total_students,
         COUNT(DISTINCT ts.student_id) AS completed, -- Đếm số SV có trong term_score
         COALESCE(ROUND(AVG(ts.total_score) FILTER (WHERE ts.total_score IS NOT NULL)), 0)::numeric(5,2) AS avg_score -- Tính TB điểm từ term_score
       FROM ref.class c
       JOIN ref.faculty f ON f.id = c.faculty_id
       LEFT JOIN ref.student s ON s.class_id = c.id
       LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
       WHERE f.code = $1
       GROUP BY c.id, c.code, c.name -- Group by c.id để hiệu quả hơn
       ORDER BY c.code
     `, [faculty_code, term]);

    res.json(rows);
  } catch (err) {
    console.error('Faculty Get Classes Error:', err);
    next(err);
  }
};

// Controller để Khoa xem SV (tương tự admin nhưng có kiểm tra quyền)
exports.getClassStudents = async (req, res, next) => {
    const { class_code, term, username } = req.query; // Thêm username để check quyền
    if (!class_code || !term || !username) {
        return res.status(400).json({ error: 'missing_params_faculty_students' });
    }

    try {
        const faculty_code = await checkFacultyAccess(username.trim());
        if (!faculty_code) {
            return res.status(403).json({ error: 'forbidden_or_not_faculty' });
        }

        // Kiểm tra xem lớp này có thuộc khoa của user không
        const classCheck = await pool.query(
            `SELECT 1 FROM ref.class c JOIN ref.faculty f ON c.faculty_id = f.id
             WHERE c.code = $1 AND f.code = $2`,
            [class_code.trim(), faculty_code]
        );

        if (!classCheck.rowCount) {
             return res.status(403).json({ error: 'class_not_in_faculty' });
        }


        // Lấy danh sách SV (tương tự admin)
        const { rows } = await pool.query(`
        SELECT
            s.student_code, s.full_name,
            c.code AS class_code,
            COALESCE(ts.total_score, 0)::int AS total_score
        FROM ref.class c
        JOIN ref.student s ON s.class_id = c.id
        LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
        WHERE c.code = $1
        GROUP BY s.student_code, s.full_name, c.code, ts.total_score
        ORDER BY s.student_code
        `, [class_code.trim(), term]);

        res.json(rows);
    } catch (err) {
        console.error('Faculty Get Class Students Error:', err);
        next(err);
    }
};