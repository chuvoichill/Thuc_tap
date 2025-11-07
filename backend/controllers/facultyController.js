// backend/controllers/facultyController.js
import {getFacultyCodeByUsername, listClassesByFacultyAndTerm, isClassInFaculty, listStudentsInClassForTerm,} from '../models/facultyModel.js';

export const getClasses = async (req, res) => {
  const { username, term } = req.query || {};
     if (!username || !term) 
    return res.status(400).json({ error: 'Lỗi hệ thống!' });

  try {
    const faculty_code = await getFacultyCodeByUsername(String(username).trim());
    if (!faculty_code) {
      return res.status(403).json({ error: 'Lỗi hệ thống, không có mã khoa' });

    }

    const rows = await listClassesByFacultyAndTerm(faculty_code, String(term).trim());
    res.json(rows);
  } catch (err) {
    console.error('controller: Faculty Get Classes Error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống!' });
  }
};

export const getClassStudents = async (req, res) => {
  const { class_code, term, username } = req.query || {};
  if (!class_code || !term || !username) {
    return res.status(400).json({ error: 'missing_params_faculty_students' });
  }

  try {
    const faculty_code = await getFacultyCodeByUsername(String(username).trim());
    if (!faculty_code) {
      return res.status(403).json({ error: 'Bạn không có quyền của khoa!' });
    }

    const code = String(class_code).trim();
    const inFaculty = await isClassInFaculty(code, faculty_code);
    if (!inFaculty) {
      return res.status(403).json({ error: 'Lớp không có trong khoa!' });
    }

    const rows = await listStudentsInClassForTerm(code, String(term).trim());
    res.json(rows);
  } catch (err) {
     console.error('lỗi ở getClassStudents controller:', err);
     res.status(500).json({ error: 'Lỗi hệ thống!' });
  }
};
