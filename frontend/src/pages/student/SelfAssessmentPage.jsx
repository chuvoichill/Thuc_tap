import { useState, useEffect, useCallback } from 'react';
import { Container, Alert, Modal} from 'react-bootstrap'; // Import components từ React-Bootstrap
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
  const [showWarning, setShowWarning] = useState(false);
  const [warningLevel, setWarningLevel] = useState('');
  const [latestTermScore, setLatestTermScore] = useState(null);

  // Hàm kiểm tra và hiển thị cảnh báo dựa trên điểm kỳ gần nhất

  const checkWarning = (score) => {
    const warningKey = `warning_shown_${term}`;
    const hasShown = sessionStorage.getItem(warningKey);

    if (hasShown) return;

    if (score < 35) {
      setWarningLevel('danger');
      setShowWarning(true);
      sessionStorage.setItem(warningKey, 'true');
    } else if (score <= 49) {
      setWarningLevel('warning');
      setShowWarning(true);
      sessionStorage.setItem(warningKey, 'true');
    } else if (score <= 64) {
      setWarningLevel('info');
      setShowWarning(true);
      sessionStorage.setItem(warningKey, 'true');
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
        checkWarning(dataHistory[0].total_score);
        setLatestTermScore(dataHistory[0].term_code);
      }

      const [critRes, selfRes, statusRes] = await Promise.all([
        getCriteria(term),
        getSelfAssessment(user.student_code, term),
        api.get(`/api/terms/${term}/status`)
      ]);
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
  const handleSubmit = async (items) => {
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
    <Container fluid>
      <Modal show={showWarning} onHide={() => setShowWarning(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {warningLevel === 'danger'}
            {warningLevel === 'warning'}
            {warningLevel === 'info'}
            {warningLevel === 'danger' ? 'Cảnh báo nghiêm trọng' :
              warningLevel === 'warning' ? 'Cảnh báo điểm rèn luyện' :
                'Nhắc nhở'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {warningLevel === 'danger' && (
            <Alert variant="danger" className="mb-3">
              <strong>{`Điểm rèn luyện ${latestTermScore} < 35 điểm (Xếp loại Kém)`}</strong>
              <p className="mb-0 mt-2">Sinh viên bị xếp loại rèn luyện kém trong cả năm học thì phải
                tạm ngừng học một năm học ở năm học tiếp theo và nếu bị xếp loại rèn luyện kém cả năm
                lần thứ hai thì sẽ bị buộc thôi học. </p>
            </Alert>
          )}
          {warningLevel === 'warning' && (
            <Alert variant="warning" className="mb-3">
              <strong>{`Điểm rèn luyện ${latestTermScore} ≤ 49 điểm (Xếp loại Yếu)`}</strong>
              <p className="mb-0 mt-2">Bạn nên chú ý cải thiện để đạt kết quả tốt hơn.</p>
            </Alert>
          )}
          {warningLevel === 'info' && (
            <Alert variant="info" className="mb-3">
              <strong>{`Điểm rèn luyện ${latestTermScore} ≤ 64 điểm (Xếp loại Trung bình)`}</strong>
              <p className="mb-0 mt-2">Hãy cố gắng thêm để đạt xếp loại cao hơn.</p>
            </Alert>
          )}
          <div className="mt-3">
            <strong>Gợi ý cải thiện:</strong>
            <ul className="mt-2 mb-0">
              <li>Tham gia đầy đủ các hoạt động của lớp, khoa</li>
              <li>Tích cực tham gia CLB, đội nhóm</li>
              <li>Hoàn thành tốt các nhiệm vụ được giao</li>
              <li>Liên hệ cố vấn học tập để được hỗ trợ</li>
            </ul>
          </div>
        </Modal.Body>
      </Modal>

      <div className="section-title mb-3">
        <b>TỰ ĐÁNH GIÁ</b>
      </div>
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
        studentCode={user?.student_code}
        termCode={term}
      />
    </Container>
  );
};

export default SelfAssessmentPage;