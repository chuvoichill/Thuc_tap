import {
  getfaculty,
  getStudent,
  postAccept,
} from "../../models/adminModel/faculty_classMModel.js";

// Lấy danh sách khoa
export const getFaculties = async (req, res, next) => {
  const { term } = req.query || {};
  if (!term) return res.status(400).json({ error: "Không có kì học" });

  try {
    const rows = await getfaculty(term);
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getfaculty", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

// Lấy danh sách sinh viên
export const getClassStudents = async (req, res) => {
  const { class_code, term } = req.query || {};
  if (!class_code || !term)
    return res.status(400).json({ error: "Không có kì học" });

  try {
    const rows = await getStudent(class_code, term);
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getClassStudents", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};


//Admin duyet diem
export const postAcceptAdmin = async (req, res) => {
  const { term } = req.body;
  const user_id = req.user?.user_id;

  if (!term) return res.status(400).json({ message: "Không tìm thấy học kì" });
  
  try {
    await postAccept(term, user_id);
    return res.status(200).json({ message: 'Đã duyệt thành công' });
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ message: err.message });
    
    console.error("Lỗi ở postAcceptAdmin", err);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
