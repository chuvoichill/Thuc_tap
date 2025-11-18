import bcrypt from 'bcryptjs';
import pool from '../db.js';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_TTL = '15m'; //thoi gian song cua access token

export const login = async (req, res, next) => { // Thêm next để chuyển lỗi

  //lấy input
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Sai tài khoản hoặc mật khẩu!' });
  }
 
  try {
     // lấy hash password trong db 
    const { rows } = await pool.query(
      `SELECT username, password_hash, display_name, role_code, student_code, faculty_code, is_active
       FROM auth.user_account WHERE username = $1`,
      [username.trim()]
    );
    if (!rows.length || rows[0].is_active !== true) {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu!' });
    }

    //so sánh pass trong db vs ng dùng nhập vào
    const u = rows[0];
    let passwordMatch = false;
    if (u.password_hash && u.password_hash.startsWith('$2')) { 
      // Bcrypt hash
      passwordMatch = await bcrypt.compare(password, u.password_hash);
    } else { 
      // cái này để tạm plain text vì không có signup nên ko hash password
      passwordMatch = (password === u.password_hash);
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu!' });
    }

    //payload cho jwt
    const payload = {
      username: u.username,
      role: u.role_code,
      student_code: u.student_code,
      faculty_code: u.faculty_code,
    };

    //nếu khớp thì tạo accesstoken với jwt, cái này mã hóa toàn bộ tt trong payload và secret trong env thành string mã và gán vào access token
    const accessToken = jwt.sign(
            payload,
            process.env.ACCESS_TOKEN_SECRET, 
            {expiresIn: ACCESS_TOKEN_TTL }
    );

    //trả về token cho client
    // Set header Content-Type: application/json
    // Chuyển object JS thành JSON
    res.json({
      token: accessToken,
      role: u.role_code,
      display_name: u.display_name,
      username: u.username,
      student_code: u.student_code || null,
      faculty_code: u.faculty_code || null,
    });

  } catch (err) {
     console.error('Lỗi ở authController!', err);
     next(err); // Chuyển lỗi cho global error handler
  }
};