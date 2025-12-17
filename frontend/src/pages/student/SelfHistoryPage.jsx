import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Alert, Container, Button } from 'react-bootstrap'; // Import components
import useAuth from '../../hooks/useAuth';
import { getCriteria, getSelfAssessment } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AssessmentForm from '../../components/drl/AssessmentForm';

const SelfHistoryPage = () => {
  const { termCode } = useParams();
  const { user } = useAuth();
  const [criteria, setCriteria] = useState([]);
  const [selfData, setSelfData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hàm gọi API lấy tiêu chí và điểm tự đánh giá cho kỳ được chọn
  const fetchData = useCallback(async () => {
    if (!termCode || !user?.student_code) return;

    setLoading(true);
    setError(null);
    try {
      const [critRes, selfRes] = await Promise.all([
        getCriteria(termCode),
        getSelfAssessment(user.student_code, termCode)
      ]);
      setCriteria(critRes);
      setSelfData(selfRes);
    } catch (e) {
      setError('Không tải được chi tiết đánh giá: ' + e.message);
    }
    setLoading(false);
  }, [termCode, user?.student_code]);

  // Gọi fetchData khi termCode hoặc user thay đổi
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Render loading hoặc lỗi nếu có
  if (loading) return <LoadingSpinner />;
  // Thay thế div.alert.alert-danger bằng Alert variant="danger"
  if (error) return <Alert variant="danger">{error}</Alert>;

  // Render nội dung chính
  return (
    <Container fluid>
      {/* Nút quay lại trang lịch sử tổng quát */}
      {/* Thay thế btn.btn-outline-secondary.btn-sm bằng as={Button} variant="outline-secondary" size="sm" */}
      <Link
        to="/history"
        className="mb-3 btn btn-outline-success btn-sm"
      >
        <i className="bi bi-arrow-left me-1"></i> Quay lại Lịch sử
      </Link>

      <div className="section-title mb-3">
        <b>CHI TIẾT ĐIỂM RÈN LUYỆN - {termCode}</b>
      </div>

      {/* Tái sử dụng AssessmentForm ở chế độ chỉ đọc */}
      <AssessmentForm
        criteria={criteria}
        selfData={selfData}
        readOnly={true}
        page="SelfHistoryPage"
        studentCode={user?.student_code}
        termCode={termCode}
      />
       <div className="mt-3 text-muted small text-end">
         <i className="bi bi-lock me-1"></i>Chế độ xem lại – **không thể chỉnh sửa**
       </div>
    </Container>
  );
};

export default SelfHistoryPage;