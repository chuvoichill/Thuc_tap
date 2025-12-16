import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Alert} from 'react-bootstrap'; // Import components từ React-Bootstrap
import { getCriteria, getSelfAssessment, saveSelfAssessment } from '../../services/drlService';
import useNotify from '../../hooks/useNotify';
import LoadingSpinner from '../common/LoadingSpinner';
import AssessmentForm from './AssessmentForm';

const StudentAssessmentModal = ({ studentCode, studentName, term, onClose, page }) => {
  const { notify } = useNotify();

  // State quản lý Modal: Quản lý show/hide nội bộ
  const [show, setShow] = useState(true); 
  
  const didSaveRef = useRef(false);
  const modalRef = useRef(null); // Ref để tìm form submit
  
  const [criteria, setCriteria] = useState([]);
  const [selfData, setSelfData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Hàm xử lý đóng Modal (khi bấm nút đóng, ESC, hoặc backdrop)
  const handleClose = () => {
    setShow(false); // Kích hoạt React-Bootstrap ẩn Modal (gọi onExited sau đó)
  };
  
  // Hàm này được gọi *sau* khi Modal đã ẩn hoàn toàn (animation kết thúc)
  const handleExited = () => {
    // Gọi onClose (Hàm này phải gỡ component khỏi DOM)
    onClose(didSaveRef.current);
  };

  // Tải dữ liệu
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [critRes, selfRes] = await Promise.all([
        getCriteria(term),
        getSelfAssessment(studentCode, term),
      ]);
      setCriteria(critRes || []);
      setSelfData(selfRes || []);
    } catch (e) {
      setError(e?.message || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, [term, studentCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Lưu
  const handleSubmit = async (items, note) => {
    setSaving(true);
    try {
      await saveSelfAssessment(studentCode, term, items, note);
      notify('Đã lưu thành công!');
      didSaveRef.current = true;
      handleClose(); // Tự động đóng modal sau khi lưu thành công
    } catch (e) {
      notify('Lỗi khi lưu: ' + (e?.message || 'Unknown error'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Thay thế toàn bộ logic JS Modal bằng component Modal
  return (
    <Modal
      show={show}              // Quản lý hiển thị
      onHide={handleClose}     // Kích hoạt khi đóng (ESC, nút đóng, backdrop)
      onExited={handleExited}  // Kích hoạt sau khi ẩn hoàn tất (để unmount)
      size="lg"
      scrollable
      ref={modalRef} // Thêm ref vào đây để tìm form bên trong Modal.Body
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Đánh giá sinh viên - {studentName} ({studentCode}) – {term}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading && <LoadingSpinner />}
        {error && <Alert variant="danger">{error}</Alert>}
        
        {!loading && !error && (
          <AssessmentForm
            criteria={criteria}
            selfData={selfData}
            onSubmit={handleSubmit}
            isSaving={saving}
            readOnly={false}
            page={page}
          />
        )}
      </Modal.Body>
    </Modal>
  );
};

export default StudentAssessmentModal;