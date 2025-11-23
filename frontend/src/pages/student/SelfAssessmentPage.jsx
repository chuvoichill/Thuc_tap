import { useState, useEffect, useCallback } from 'react';
import { Container, Alert, Modal } from 'react-bootstrap'; // Import components từ React-Bootstrap
import { useTerm } from '../../layout/DashboardLayout';
import useAuth from '../../hooks/useAuth';
import useNotify from '../../hooks/useNotify';
import { getCriteria, getSelfAssessment, saveSelfAssessment, getStudentHistory } from '../../services/drlService';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner'; // Giữ lại nếu là component custom
import AssessmentForm from '../../components/drl/AssessmentForm';

const SelfAssessmentPage = () => {
  const { term } = useTerm();
  const { user } = useAuth();
  const { notify } = useNotify();

  // State lưu trữ dữ liệu
  const [criteria, setCriteria] = useState([]);
  const [selfData, setSelfData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isActive, setIsActive] = useState(true);

  //State modal cảnh báo
  const [showWarning, setShowWarning] = useState(false);

  const handleClose = () => setShowWarning(false);
  const handleShow = () => setShowWarning(true);

  //Hàm kiểm tra điều kiện cảnh báo
  const checkWarningCondition = (total_score) => {
    if (total_score <= 35) {
      handleShow();
    }
  };

  // Hàm tải dữ liệu (tiêu chí, điểm đã lưu, trạng thái kỳ)
  const fetchData = useCallback(async () => {
    if (!term || !user?.student_code) return;

    setLoading(true);
    setError(null);
    setIsActive(true);
    try {
      const dataHistory = await getStudentHistory(user.student_code);
      if (dataHistory && dataHistory.length > 0) {
        checkWarningCondition(dataHistory[0].total_score);
      }

      const [critRes, selfRes, statusRes] = await Promise.all([
        getCriteria(term),
        getSelfAssessment(user.student_code, term),
        api.get(`/api/terms/${term}/status`)
      ]);
      console.log('Term Status Response:', statusRes);
      setCriteria(critRes || []);
      setSelfData(selfRes || []);
      setIsActive(statusRes?.isActive !== undefined ? statusRes.isActive : true);

    } catch (e) {
      setError('Không tải được dữ liệu đánh giá: ' + e.message);
      setIsActive(false);
    }
    setLoading(false);
  }, [term, user?.student_code]);

  // Gọi fetchData khi component mount hoặc fetchData thay đổi
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hàm xử lý khi người dùng bấm nút "Gửi đánh giá"
  const handleSubmit = async (items, total) => {
    if (!isActive) {
      notify('Kỳ đánh giá này đã bị khóa.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await saveSelfAssessment(user.student_code, term, items);
      notify('Đã lưu đánh giá thành công!');
    } catch (e) {
      if (e.message === 'assessment_period_closed') {
        notify('Kỳ đánh giá đã bị khóa. Không thể lưu.', 'danger');
        setIsActive(false);
      } else {
        notify('Lỗi khi lưu: ' + e.message, 'danger');
      }
    }
    setSaving(false);
  };

  // Render UI
  if (loading) return <LoadingSpinner />;
  // Thay thế div.alert.alert-danger bằng Alert variant="danger"
  if (error) return <Alert variant="danger">{error}</Alert>;

  // Render nội dung chính
  return (
    // Dùng Container để bao bọc nội dung nếu cần
    <Container fluid>
      {/* Cảnh báo sv drl yếu kém */}
      <Modal show={showWarning} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cảnh báo đánh giá rèn luyện</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Điểm đánh giá rèn luyện của bạn trong kỳ trước ≤ 35 điểm. Bạn cần chú ý cải thiện để đạt kết quả tốt hơn.
          </p>
        </Modal.Body>
      </Modal>


      <div className="section-title mb-3">
        <i className="bi bi-clipboard2-check me-2"></i>
        TỰ ĐÁNH GIÁ – Kỳ <span className="fw-bold">{term}</span>
      </div>

      {/* Thay thế div.alert.alert-warning bằng Alert variant="warning" */}
      {!isActive && (
        <Alert variant="warning">
          <i className="bi bi-lock-fill me-2"></i> Kỳ đánh giá này đã được **khóa**. Bạn không thể chỉnh sửa.
        </Alert>
      )}

      {/* Component Form đánh giá */}
      <AssessmentForm
        criteria={criteria}
        selfData={selfData}
        onSubmit={handleSubmit}
        isSaving={saving}
        readOnly={!isActive}
        page="SelfAssessmentPage"
      />
    </Container>
  );
};

export default SelfAssessmentPage;