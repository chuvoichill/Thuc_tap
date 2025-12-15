import pool from '../db.js';

/**
 * Lấy thông tin user theo username
 * Bao gồm roles, student_id, teacher_id, faculty_id
 */
export const getUserByUsername = async (username) => {
  const query = `
    SELECT 
      ua.id,
      ua.username,
      ua.password,
      ua.is_active,
      
      -- Get roles (joined from user_account_role)
      ARRAY_AGG(DISTINCT r.name) as role_names,
      ARRAY_AGG(DISTINCT r.id) as role_ids,
      
      -- Get profile data
      uap.student_id,
      uap.teacher_id,
      uap.faculty_id
      
    FROM auth.user_accounts ua
    LEFT JOIN auth.user_account_role uar ON ua.id = uar.user_account_id
    LEFT JOIN auth.roles r ON uar.role_id = r.id
    LEFT JOIN auth.user_account_profile uap ON ua.id = uap.user_id
    WHERE ua.username = $1
    GROUP BY ua.id, ua.username, ua.password, ua.is_active, uap.student_id, uap.teacher_id, uap.faculty_id
  `;
  
  const { rows } = await pool.query(query, [username]);
  return rows[0] || null;
};

/**
 * Lấy thông tin student từ student_id
 */
export const getStudentById = async (studentId) => {
  if (!studentId) return null;
  
  const query = `
    SELECT 
      s.id,
      s.student_code,
      s.name,
      s.class_id,
      c.name as class_code,
      c.name as class_name,
      f.id as faculty_id,
      f.name as faculty_name
    FROM ref.students s
    LEFT JOIN ref.classes c ON s.class_id = c.id
    LEFT JOIN ref.faculties f ON c.faculty_id = f.id
    WHERE s.id = $1
  `;
  
  const { rows } = await pool.query(query, [studentId]);
  return rows[0] || null;
};

/**
 * Lấy thông tin teacher từ teacher_id
 */
export const getTeacherById = async (teacherId) => {
  if (!teacherId) return null;
  
  const query = `
    SELECT 
      t.id,
      t.teacher_code,
      t.name,
      t.faculty_id,
      f.name as faculty_name,
      f.code as faculty_code
    FROM ref.teachers t
    LEFT JOIN ref.faculties f ON t.faculty_id = f.id
    WHERE t.id = $1
  `;
  
  const { rows } = await pool.query(query, [teacherId]);
  return rows[0] || null;
};

/**
 * Lấy thông tin faculty từ faculty_id
 */
export const getFacultyById = async (facultyId) => {
  if (!facultyId) return null;
  
  const query = 'SELECT id, faculty_code, name FROM ref.faculties WHERE id = $1';
  
  const { rows } = await pool.query(query, [facultyId]);
  return rows[0] || null;
};

/**
 * Lấy danh sách roles của user
 */
export const getUserRoles = async (userId) => {
  const query = `
    SELECT 
      r.id,
      r.name,
      r.code
    FROM auth.roles r
    JOIN auth.user_account_role uar ON r.id = uar.role_id
    WHERE uar.user_account_id = $1
  `;
  
  const { rows } = await pool.query(query, [userId]);
  return rows;
};

/**
 * Tạo user mới (cho signup sau này)
 */
export const createUser = async (username, passwordHash) => {
  const query = `
    INSERT INTO auth.user_accounts (username, password, is_active)
    VALUES ($1, $2, true)
    RETURNING id, username, is_active, created_at
  `;
  
  const { rows } = await pool.query(query, [username, passwordHash]);
  return rows[0];
};

/**
 * Gán role cho user
 */
export const assignRoleToUser = async (userId, roleId) => {
  const query = `
    INSERT INTO auth.user_account_role (user_account_id, role_id)
    VALUES ($1, $2)
    ON CONFLICT (user_account_id, role_id) DO NOTHING
    RETURNING *
  `;
  
  const { rows } = await pool.query(query, [userId, roleId]);
  return rows[0];
};

/**
 * Tạo hoặc cập nhật profile cho user
 */
export const upsertUserProfile = async (userId, { studentId = null, teacherId = null, facultyId = null }) => {
  const query = `
    INSERT INTO auth.user_account_profile (user_id, student_id, teacher_id, faculty_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      student_id = EXCLUDED.student_id,
      teacher_id = EXCLUDED.teacher_id,
      faculty_id = EXCLUDED.faculty_id,
      updated_at = NOW()
    RETURNING *
  `;
  
  const { rows } = await pool.query(query, [userId, studentId, teacherId, facultyId]);
  return rows[0];
};

/**
 * Cập nhật last login
 */
export const updateLastLogin = async (userId) => {
  // Nếu bảng có cột last_login_at, uncomment đoạn này
  // const query = `
  //   UPDATE auth.user_accounts 
  //   SET last_login_at = NOW()
  //   WHERE id = $1
  // `;
  // await pool.query(query, [userId]);
};
