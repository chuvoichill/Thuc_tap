import {
  getStudentClass,
  checkLeaderLocked,
  postLeaderAccept,
  postLockAss,
  checkTeacherClass,
  checkStudentInClass,
  removeOldClassLeader,
  assignNewClassLeader,
  removeClassLeaderByClassId,
  getClassLeaderByClassCode,
  checkClassLeaderRoleByStudentCode
} from '../models/classLeaderModel.js';

export const getStudentsLeader = async (req, res) => {
  const username = req.user?.username; // Lấy username từ req.user (authMiddleware hàm protectedRoute)
  const { term } = req.query || {};
  if (!username || !term) return res.status(400).json({ error: 'Thiếu thông tin!' });

  try {
    const rows = await getStudentClass(username, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getStudentsLeader', error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};



//Duyet toan bo SV 
export const postAcceptStudent = async (req, res) => {
  const { term } = req.body;
  const { student_id, user_id, username } = req.user;

  if (!term) return res.status(400).json({ message: 'Không tìm thấy học kì' });

  try {
    const rows = await postLeaderAccept(student_id, term, user_id, username);
    const lock = await postLockAss(student_id, term);
    res.json(rows);
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ error: "Cảnh báo", message: error.message });

    console.error('Lỗi ở acceptAssessment', error);
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};

// Kiểm tra trạng thái khóa của leader
export const getLeaderLockStatus = async (req, res) => {
  const { student_id } = req.user;
  const { term } = req.query;

  if (!term) return res.status(400).json({ message: 'Không tìm thấy học kì' });

  try {
    const isLocked = await checkLeaderLocked(student_id, term);
    res.json({ isLocked });
  } catch (error) {
    console.error('Lỗi ở getLeaderLockStatus', error);
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};

// Giáo viên chỉ định lớp trưởng
export const assignClassLeader = async (req, res) => {
  const { student_code, class_code } = req.body;
  const teacher_username = req.user?.username; // Giáo viên đang đăng nhập

  if (!student_code || !class_code) {
    return res.status(400).json({ error: 'Thiếu thông tin student_code hoặc class_code' });
  }

  try {
    // 1. Kiểm tra giáo viên có phải là GVCN của lớp này không
    const classInfo = await checkTeacherClass(class_code, teacher_username);
    if (!classInfo) {
      return res.status(403).json({ error: 'Bạn không phải GVCN của lớp này' });
    }

    const class_id = classInfo.id;

    // 2. Kiểm tra sinh viên có thuộc lớp này không
    const studentInfo = await checkStudentInClass(student_code, class_id);
    if (!studentInfo) {
      return res.status(400).json({ error: 'Sinh viên không thuộc lớp này' });
    }

    const student_id = studentInfo.id;

    // 3. Bỏ chỉ định lớp trưởng cũ (nếu có)
    await removeOldClassLeader(class_id);

    // 4. Chỉ định lớp trưởng mới
    await assignNewClassLeader(student_id);

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


// Giáo viên bỏ chỉ định lớp trưởng

export const removeClassLeader = async (req, res) => {
  const { class_code } = req.body;
  const teacher_username = req.user?.username;

  if (!class_code) {
    return res.status(400).json({ error: 'Thiếu thông tin class_code' });
  }

  try {
    // Kiểm tra giáo viên có phải GVCN không
    const classInfo = await checkTeacherClass(class_code, teacher_username);
    if (!classInfo) {
      return res.status(403).json({ error: 'Bạn không phải GVCN của lớp này' });
    }

    const class_id = classInfo.id;

    // Bỏ chỉ định lớp trưởng
    const removedStudent = await removeClassLeaderByClassId(class_id);

    if (!removedStudent) {
      return res.status(400).json({ error: 'Lớp này chưa có lớp trưởng' });
    }

    res.json({
      message: 'Đã bỏ chỉ định lớp trưởng',
      student_code: removedStudent.student_code
    });

  } catch (error) {
    console.error('Lỗi khi bỏ chỉ định lớp trưởng:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

//Lấy thông tin lớp trưởng của lớp
export const getClassLeader = async (req, res) => {
  const { class_code } = req.query;
  const teacher_username = req.user?.username;

  if (!class_code) {
    return res.status(400).json({ error: 'Thiếu class_code' });
  }

  try {
    const classLeader = await getClassLeaderByClassCode(class_code, teacher_username);

    if (!classLeader) {
      return res.json({ class_leader: null });
    }

    res.json({ class_leader: classLeader });

  } catch (error) {
    console.error('Lỗi khi lấy thông tin lớp trưởng:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};


// Lớp trưởng kiểm tra quyền của mình
export const checkClassLeaderRole = async (req, res) => {
  const student_code = req.user?.student_code;

  if (!student_code) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  try {
    const studentInfo = await checkClassLeaderRoleByStudentCode(student_code);

    if (!studentInfo) {
      return res.status(404).json({ error: 'Không tìm thấy sinh viên' });
    }

    res.json({
      is_class_leader: studentInfo.is_class_leader,
      class_code: studentInfo.class_code,
      class_name: studentInfo.class_name
    });

  } catch (error) {
    console.error('Lỗi khi kiểm tra quyền lớp trưởng:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

