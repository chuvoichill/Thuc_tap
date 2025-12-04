import {
  getClass,
  getfaculty,
  getStudent,
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

// Lấy danh sách lớp
export const getClasses = async (req, res) => {
  const { term, faculty } = req.query || {};
  if (!term) return res.status(400).json({ error: "Không có kì học" });

  try {
    const rows = await getClass(term, faculty);
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getClasses", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

// Lấy danh sách sinh viên
export const getClassStudents = async (req, res, next) => {
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
