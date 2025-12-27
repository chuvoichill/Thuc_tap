import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Alert, Container, Badge } from 'react-bootstrap'; // Import components
import useAuth from '../../hooks/useAuth';
import { getCriteria, getSelfAssessment, getAssessmentNotes } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AssessmentForm from '../../components/drl/AssessmentForm';

const SelfHistoryPage = () => {
  const { termCode } = useParams();
  const { user } = useAuth();
  const [criteria, setCriteria] = useState([]);
  const [selfData, setSelfData] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hàm gọi API lấy tiêu chí và điểm tự đánh giá cho kỳ được chọn
  const fetchData = useCallback(async () => {
    if (!termCode || !user?.student_code) return;

    setLoading(true);
    setError(null);
    try {
      const [critRes, selfRes, notesRes] = await Promise.all([
        getCriteria(termCode),
        getSelfAssessment(user.student_code, termCode),
        getAssessmentNotes(user.student_code, termCode)
      ]);
      setCriteria(critRes);
      setSelfData(selfRes);
      setNotes(notesRes);
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

      {/* Hiển thị ghi chú từ giáo viên, khoa, admin */}
      <div className="mt-4">
        <h5>Ghi chú đánh giá</h5>
        {notes.length === 0 ? (
          <p className="text-muted">Chưa có ghi chú nào.</p>
        ) : (
          notes.map((note, index) => (
            <div key={index} className="mb-3 p-3 border rounded">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Badge bg={
                  note.role === 'teacher' ? 'primary' :
                  note.role === 'faculty' ? 'info' :
                  note.role === 'admin' ? 'danger' : 'secondary'
                }>
                  {note.role === 'teacher' ? 'Giáo viên' :
                   note.role === 'faculty' ? 'Khoa' :
                   note.role === 'admin' ? 'Admin' : note.role}
                </Badge>
                <small className="text-muted">
                  {new Date(note.updated_at).toLocaleString('vi-VN')}
                </small>
              </div>
              <p className="mb-1">{note.note || 'Không có ghi chú'}</p>
              {note.total_score !== null && (
                <small className="text-muted">Điểm: {note.total_score}</small>
              )}
            </div>
          ))
        )}
      </div>

       <div className="mt-3 text-muted small text-end">
         <i className="bi bi-lock me-1"></i>Chế độ xem lại – **không thể chỉnh sửa**
       </div>
    </Container>
  );
};

export default SelfHistoryPage;