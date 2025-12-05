import {
  getGroupCri,
  postGroupCri,
  putGroupCri,
  deleteGroupCri,
} from "../../models/adminModel/groupMModel.js";

// --- Group Controllers (CRUD Groups) ---

// Lấy danh sách Group
export const getGroups = async (req, res) => {
  const { term } = req.query || {};
  if (!term) return res.status(400).json({ error: "Không tìm thấy năm học" });

  try {
    const rows = await getGroupCri(term);
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getGroups", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

// Tạo mới Group
export const createGroup = async (req, res) => {
  const { term_code, code, title } = req.body;
  if (!term_code || !code || !title)
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào" });

  try {
    const rows = await postGroupCri(term_code, code, title);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Trùng dữ liệu", detail: error.detail });
    }
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

// Cập nhật Group
export const updateGroup = async (req, res) => {
  const { id } = req.params;
  const { code, title } = req.body;
  if (!code || !title) {
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào" });
  }

  try {
    const rows = await putGroupCri(id, code, title);
    res.status(200).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Trùng dữ liệu", detail: error.detail });
    }

    console.error("Lỗi ở updateGroup", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

// Xóa Group
export const deleteGroup = async (req, res) => {
  const { id } = req.params;

  try {
    await deleteGroupCri(id);
    res.status(200).json({
      ok: true,
      message: "Nhóm tiêu chí đã được xóa.",
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Lỗi ở deleteGroup", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};
