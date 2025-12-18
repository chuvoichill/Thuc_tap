// @ts-nocheck
import jwt from "jsonwebtoken";

// authorization - xác minh user là ai gắn req.user
export const protectedRoute = (req, res, next) => {
  try {
    // lấy token từ header
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ message: "Không tìm thấy access token" });
    }

    // xác nhận token hợp lệ
    //decodedUser: nội dung bên trong token (payload) sau khi đã giải mã. là hàm jwt.sign mã hóa nó
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decodedUser) => {
      if (err) {
        console.error(err);
        return res.status(403).json({ message: "Access token hết hạn hoặc không đúng" });
      }

    // decodedUser = payload đã sign ở controller: { id, username, role, student_code, faculty_code, iat, exp } được giải mã qua hàm verify
    // trả user về trong req
    // tạo thêm field mới tên user trên object req và gán giá trị decodedUser cho nó
      req.user = decodedUser;
      next();
    });

  } catch (error) {
    console.error("Lỗi khi xác minh JWT trong authMiddleware", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// đọc req.user.role để kiểm tra role
export const requireRole = (...roles) => {
  return (req, res, next) => {
    // Kiểm tra xem req.user có tồn tại và role của user có nằm trong danh sách cho phép không
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Không đủ quyền!' });
    }
    next();
  };
};

// Middleware cho phép cả teacher và class_leader
export const requireTeacherOrClassLeader = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    // Nếu là teacher thì cho phép
    if (req.user.role === 'teacher') {
      return next();
    }

    // Nếu là student, kiểm tra xem có phải lớp trưởng không
    if (req.user.role === 'student' && req.user.student_code) {
      const { default: pool } = await import('../db.js');
      const result = await pool.query(
        'SELECT is_class_leader FROM ref.students WHERE student_code = $1',
        [req.user.student_code]
      );
      
      if (result.rows.length > 0 && result.rows[0].is_class_leader === true) {
        req.isClassLeader = true; // Đánh dấu để dùng sau
        return next();
      }
    }

    return res.status(403).json({ message: 'Chỉ giáo viên hoặc lớp trưởng mới có quyền này' });

  } catch (error) {
    console.error('Lỗi trong requireTeacherOrClassLeader:', error);
    return res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};

