import { getStudents,postLockAss, getAllStudentsInClass, postAccept,checkTeacherLocked} from '../models/teacherModel.js';

export const getAllStudents = async (req, res) => {
  const teacher_id = req.user?.teacher_id; // Lấy teacher_id từ req.user (authMiddleware hàm protectedRoute)
  const {term} = req.query || {};
  if (!teacher_id || !term) return res.status(400).json({ error: 'Thiếu thông tin!' });

  try {
    const rows = await getStudents(teacher_id, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getStudent', error);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};


// Lấy tất cả sinh viên trong lớp (cho chức năng chọn lớp trưởng)
export const getAllStudentsInClassController = async (req, res) => {
  const teacher_id = req.user?.teacher_id;
  const { term } = req.query || {};
  
  if (!teacher_id || !term) {
    return res.status(400).json({ error: 'Thiếu thông tin!' });S
  }

  try {
    const rows = await getAllStudentsInClass(teacher_id, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getAllStudentsInClass', error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

//Duyet toan bo SV 
export const postAcceptStudent = async (req,res) =>{
  const { term } = req.body;
  const { teacher_id,user_id} = req.user;

  if (!term) return res.status(400).json({ message: 'Không tìm thấy học kì' });

  try {
    const rows = await postAccept(teacher_id, term, user_id);
    const lock = await postLockAss(teacher_id, term);
    res.json(rows);
  } catch (error) {
    if (error.status === 403) return res.status(403).json({error: "Lớp trưởng chưa duyệt"});

    console.error('Lỗi ở acceptAssessment', error);   
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};

  // Kiểm tra trạng thái khóa của giáo viên
  export const getTeacherLockStatus = async (req, res) => {
    const { teacher_id } = req.user;
    const { term } = req.query;
  
    if (!term) return res.status(400).json({ message: 'Không tìm thấy học kì' });
  
    try {
      const isLocked = await checkTeacherLocked(teacher_id, term);
      res.json({ isLocked });
    } catch (error) {
      console.error('Lỗi ở getTeacherLockStatus', error);
      res.status(500).json({ message: 'Lỗi hệ thống' });
    }
  };
