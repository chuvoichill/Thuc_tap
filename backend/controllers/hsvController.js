import {getClass,getStudents, postConfirm, postUnconfirm} from '../models/hsvModel.js'

export const getListClass = async (req, res) => {
  const faculty_code = req.user?.faculty_code; // Lấy faculty_code từ req.user (authMiddleware hàm protectedRoute)
  const { term } = req.query || {};
  if (!faculty_code || !term) 
  {
    console.log('Thiếu thông tin trong getListClass:', { faculty_code, term });
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }
    
  try {
    const rows = await getClass(term,faculty_code);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getClasses(hsvController)', error);
    res.status(500).send({message:"Lỗi hệ thống"});
  }
};

export const getListStudents = async (req, res) => {
  const { class_code, term} = req.query;
  if (!class_code || !term) 
  {
    console.log('Thiếu thông tin trong getListStudents(hsvController):', { class_code, term });
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }
  try {
    const rows = await getStudents(class_code, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getListStudents', error);
    res.status(500).send({message:"Lỗi hệ thống"});
  }
};


export const postConfirmAssessment = async (req, res,) => {
  const username = req.user?.username; // Lấy username từ req.user (authMiddleware hàm protectedRoute) 
  const { student_code, term_code,criterion_code, participated, note} = req.body || {};
  if (!student_code || !term_code || !criterion_code || typeof participated !== 'boolean' || !username) {
    console.log('Thiếu thông tin trong postConfirmAssessment:', { student_code, term_code, criterion_code, participated, username });
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }

  try {
    const confirm = await postConfirm(student_code, term_code,criterion_code, participated, note, username); 
    return res.json(confirm);
  } catch (error) {
    console.error('Lỗi ở postConfirmAssessment', error);
    res.status(500).send({message:"Lỗi hệ thống"});
  }

};

export const postUnconfirmAssessment = async (req, res) => {
  const { student_code, term_code, criterion_code } = req.body || {};
  if (!student_code || !term_code || !criterion_code) {
    return res.status(400).json({ error: 'Thiếu thông tin!' });
  }

  try {
    const result = await postUnconfirm(student_code, term_code, criterion_code);
    return res.json(result);
  } catch (error) {
    console.error('Lỗi ở postUnconfirmAssessment', error);
    res.status(500).send({message:"Lỗi hệ thống"});
  }
};