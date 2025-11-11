import {checkRole,getClass,getStudents, postConfirm} from '../models/hsvModel.js'
import pool from '../db.js';

export const getListClass = async (req, res) => {
  const { username, term } = req.query || {};
  if (!username || !term) return res.status(400).json({ error: 'missing_params' });

  try {
    const ckrole = await checkRole(username);
    if (!ckrole.allowed) {
      return res.status(403).json({ error: 'Không có quyền truy cập'});
    }
    const rows = await getClass(term,ckrole.faculty_code);
    res.json(rows);

  } catch (error) {
    console.error('Lỗi ở getClasses', error);
    res.status(500).send({message:"Lỗi hệ thống"});
  }
};

export const getListStudents = async (req, res) => {
  const { class_code, term} = req.query;
  if (!class_code || !term) return res.status(400).json({ error: 'missing_params' });

  try {
    const rows = await getStudents(class_code, term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getListStudents', error);
    res.status(500).send({message:"Lỗi hệ thống"});
  }
};


export const postConfirmAssessment = async (req, res,) => {
  const { student_code, term_code,criterion_code, participated, note, username } = req.body || {};
  console.log("Du lieu ne: ",student_code);
  console.log("Du lieu ne: ",term_code);
  console.log("Du lieu ne: ",criterion_code);
  console.log("Du lieu ne: ",participated);
  console.log("Du lieu ne: ",username);
  if (!student_code || !term_code || !criterion_code || typeof participated !== 'boolean' || !username) {
    return res.status(400).json({ error: 'missing_body_or_username' });
  }

  try {
    const confirm = await postConfirm({student_code, term_code,criterion_code, participated, note, username}); 
    return res.json(confirm);
  } catch (error) {
    console.error('Lỗi ở postConfirmAssessment', error);
    res.status(500).send({message:"Lỗi hệ thống"});
  }

};