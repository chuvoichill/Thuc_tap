import { getStudents } from '../models/teacherModel.js';

export const getAllStudents = async (req, res) => {
  const { username, term, class_code } = req.query || {};
  if (!username || !term) return res.status(400).json({ error: 'missing_params' });

  try {
    const rows = await getStudents(username, term, class_code );
    res.json(rows);
  } catch (err) {
    console.error('Lỗi ở getStudent', err);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};