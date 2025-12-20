import { getTerm,getTerm_Status} from '../models/termModel.js';

// Lấy danh sách học kỳ (dành cho dropdown chung)
export const getAllTerms = async (req, res) => {
  try {
    const rows = await getTerm();
    res.json(rows);
  } catch (error) {
    console.error('Loi o GetAllTerms:', error);
  }
};

// Lấy trạng thái Mở/Khóa đánh giá của một kỳ (dùng cho SelfAssessmentPage)
export const getTermStatus = async (req, res) => {
  const { termCode } = req.params;

  try {
    const term = await getTerm_Status(termCode);

    if (!term)  return res.json({ isActive: false });

    res.json({ isActive: term.is_active });
  } catch (error) {
    console.error("Lỗi ở getTerm_Status", error);
    res.status(500).json({ isActive: false });
  }
};
