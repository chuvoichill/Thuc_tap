import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  getUserByUsername,
  getStudentById,
  getTeacherById,
  getFacultyById,
  updateLastLogin
} from '../models/authModel.js';

const ACCESS_TOKEN_TTL = '500m'; //thoi gian song cua access token

export const login = async (req, res, next) => { // Thêm next để chuyển lỗi

  //lấy input
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Sai tài khoản hoặc mật khẩu!' });
  }
 
  try {
    // Lấy thông tin user từ database mới
    const user = await getUserByUsername(username.trim());
    
    if (!user || user.is_active !== true) {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu!' });
    }

    //so sánh pass trong db vs ng dùng nhập vào
    let passwordMatch = false;
    if (user.password && user.password.startsWith('$2')) { 
      // Bcrypt hash
      passwordMatch = await bcrypt.compare(password, user.password);
    } else { 
      // cái này để tạm plain text vì không có signup nên ko hash password
      passwordMatch = (password === user.password);
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu!' });
    }

    // Lấy thông tin bổ sung dựa trên profile
    let studentInfo = null;
    let teacherInfo = null;
    let facultyInfo = null;
    let primaryRole = null;

    if (user.student_id) {
      studentInfo = await getStudentById(user.student_id);
      primaryRole = 'student';
    } else if (user.teacher_id) {
      teacherInfo = await getTeacherById(user.teacher_id);
      primaryRole = 'teacher';
    } else if (user.faculty_id) {
      facultyInfo = await getFacultyById(user.faculty_id);
      primaryRole = 'faculty';
    }

    // Xác định role chính (ưu tiên role đầu tiên hoặc role từ profile)
    //filter lặp và loại bỏ giá trị null/undefined
    const roles = user.role_names?.filter(r => r) || [];
    if (!primaryRole && roles.length > 0) {
      primaryRole = roles[0].toLowerCase();
    }

    // Xác định display_name
    let display_name = user.username;
    if (studentInfo) {
      display_name = studentInfo.name;
    } else if (teacherInfo) {
      display_name = teacherInfo.name;
    } else if (facultyInfo) {
      display_name = facultyInfo.name;
    }

    //payload cho jwt
    const payload = {
      user_id: user.id,
      username: user.username,
      role: primaryRole,
      // roles: roles, // -> Bỏ, ít dùng
      student_id: user.student_id,
      teacher_id: user.teacher_id,
      faculty_id: user.faculty_id, 
      student_code: studentInfo?.student_code || null,
      faculty_code: facultyInfo?.faculty_code || null,
    };


    //nếu khớp thì tạo accesstoken với jwt
    const accessToken = jwt.sign(
            payload,
            process.env.ACCESS_TOKEN_SECRET, 
            {expiresIn: ACCESS_TOKEN_TTL }
    );

    // Cập nhật last login (nếu có)
    await updateLastLogin(user.id);

    //trả về token cho client
    res.json({
      token: accessToken,
      role: primaryRole,
      roles: roles,
      display_name: display_name,
      username: user.username,
      user_id: user.id,
      
      // Thông tin student nếu có
      student_code: studentInfo?.student_code || null,
      student_id: user.student_id || null,
      class_code: studentInfo?.class_code || null,
      
      // Thông tin teacher nếu có
      teacher_code: teacherInfo?.teacher_code || null,
      teacher_id: user.teacher_id || null,
      
      // Thông tin faculty
      faculty_code: facultyInfo?.faculty_code || teacherInfo?.faculty_code || null,
      faculty_id: user.faculty_id || teacherInfo?.faculty_id || null,
      faculty_name: facultyInfo?.name || teacherInfo?.faculty_name || null,
    });

  } catch (err) {
     console.error('Lỗi ở authController!', err);
     next(err); // Chuyển lỗi cho global error handler
  }
};