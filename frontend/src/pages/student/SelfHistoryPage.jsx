import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom'; // Import useParams và Link
import useAuth from '../../hooks/useAuth';
import { getCriteria, getSelfAssessment } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AssessmentForm from '../../components/drl/AssessmentForm'; // Tái sử dụng form hiển thị

const SelfHistoryPage = () => {
  const { termCode } = useParams(); // Lấy mã kỳ từ URL, ví dụ: "2025HK1"
  const { user } = useAuth();
  const [criteria, setCriteria] = useState([]);
  const [selfData, setSelfData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hàm gọi API lấy tiêu chí và điểm tự đánh giá cho kỳ được chọn
  const fetchData = useCallback(async () => {
    if (!termCode || !user?.student_code) return; // Cần cả mã kỳ và mã SV

    setLoading(true);
    setError(null);
    try {
      // Gọi cả 2 API cùng lúc
      const [critRes, selfRes] = await Promise.all([
        getCriteria(termCode), // Lấy tiêu chí của kỳ này
        getSelfAssessment(user.student_code, termCode) // Lấy điểm SV tự chấm của kỳ này
      ]);
      setCriteria(critRes);
      setSelfData(selfRes);
    } catch (e) {
      setError('Không tải được chi tiết đánh giá: ' + e.message);
    }
    setLoading(false);
  }, [termCode, user?.student_code]); // Dependency là termCode và student_code

  // Gọi fetchData khi termCode hoặc user thay đổi
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Render loading hoặc lỗi nếu có
  if (loading) return <LoadingSpinner />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  // Render nội dung chính
  return (
    <div>
      {/* Nút quay lại trang lịch sử tổng quát */}
      <Link to="/history" className="btn btn-outline-secondary btn-sm mb-3">
        <i className="bi bi-arrow-left me-1"></i> Quay lại Lịch sử
      </Link>

      <div className="section-title mb-3">
        <i className="bi bi-clock-history me-2"></i>
        CHI TIẾT ĐÁNH GIÁ – Kỳ <span className="fw-bold">{termCode}</span> {/* Hiển thị mã kỳ */}
      </div>

      {/* Tái sử dụng AssessmentForm ở chế độ chỉ đọc */}
      <AssessmentForm
        criteria={criteria}
        selfData={selfData}
        readOnly={true} // Chỉ xem, không sửa
      />
       <div className="mt-3 text-muted small text-end">
         <i className="bi bi-lock me-1"></i>Chế độ xem lại – không thể chỉnh sửa
       </div>
    </div>
  );
};

export default SelfHistoryPage;