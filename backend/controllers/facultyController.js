// backend/controllers/facultyController.js
import { listClassesByFacultyAndTerm, isClassInFaculty, listStudentsInClassForTerm,} from '../models/facultyModel.js';

export const getClasses = async (req, res) => {
  const faculty_code = req.user?.faculty_code; // Lấy faculty_code từ req.user (authMiddleware hàm protectedRoute)
  const { term } = req.query || {};
    
  if (!faculty_code || !term) {
      console.log('Thiếu thông tin trong getClasses:', { faculty_code, term });
      return res.status(403).json({ error: 'Lỗi hệ thống, không có mã khoa và học kỳ' });
    }
    
  try {
    // const faculty_code = await getFacultyCodeByUsername(String(username).trim());
  
    const rows = await listClassesByFacultyAndTerm(faculty_code, String(term).trim());
    res.json(rows);
  } catch (err) {
    console.error('lỗi ở controller Faculty GetClasses!', err);
    res.status(500).json({ error: 'Lỗi hệ thống!' });
  }
};

export const getClassStudents = async (req, res) => {
  const faculty_code = req.user?.faculty_code;  // Lấy faculty_code từ req.user (authMiddleware hàm protectedRoute)
  const { class_code, term } = req.query || {};
  
  if (!class_code || !term || !faculty_code) {
    console.log('Thiếu thông tin trong getClassStudents:', { class_code, term, faculty_code });
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }

  try {
    const code = String(class_code).trim();
    const inFaculty = await isClassInFaculty(code, faculty_code);
    if (!inFaculty) {
      return res.status(403).json({ error: 'Lớp không có trong khoa!' });
    }

    const rows = await listStudentsInClassForTerm(code, String(term).trim());
    res.json(rows);
  } catch (err) {
     console.error('lỗi ở getClassStudents (facultycontroller):', err);
     res.status(500).json({ error: 'Lỗi hệ thống!' });
  }
};
