import { getSearchClassStudents } from "../../models/adminModel/searchMModel.js";

// Tìm kiếm sinh viên
export const searchClass = async (req, res) => {
  const student = req.query;
  if (!student || student.length === 0) {
    return res.status(400).json({ error: "Thiếu dữ liệu" });
  }
  try {
    const search = await getSearchClassStudents(student);
    res.json(search);
  } catch (error) {
    console.error("Lỗi ở searchClass", error);
    res.status(500).json({ error: "Lỗi hệ thống", detail: error.message });
  }
};
