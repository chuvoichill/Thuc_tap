import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { assignClassLeader, removeClassLeader, getClassLeader } from '../../services/drlService';
import useNotify from '../../hooks/useNotify';

const AssignClassLeaderModal = ({ show, onHide, students, classCode, onSuccess }) => {
  const { notify } = useNotify();
  const [selectedStudent, setSelectedStudent] = useState('');
  const [currentLeader, setCurrentLeader] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show && classCode) {
      loadCurrentLeader();
    }
  }, [show, classCode]);

  const loadCurrentLeader = async () => {
    try {
      const data = await getClassLeader(classCode);
      setCurrentLeader(data.class_leader);
      if (data.class_leader) {
        setSelectedStudent(data.class_leader.student_code);
      }
    } catch (error) {
      console.error('Lỗi khi tải lớp trưởng hiện tại:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedStudent) {
      notify('Vui lòng chọn sinh viên', 'warning');
      return;
    }

    setLoading(true);
    try {
      await assignClassLeader(selectedStudent, classCode);
      notify('Đã chỉ định lớp trưởng thành công!', 'success');
      if (onSuccess) onSuccess();
      onHide();
    } catch (error) {
      notify('Lỗi: ' + (error.response?.data?.error || error.message), 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Bạn có chắc muốn bỏ chỉ định lớp trưởng?')) return;

    setLoading(true);
    try {
      await removeClassLeader(classCode);
      notify('Đã bỏ chỉ định lớp trưởng', 'info');
      setCurrentLeader(null);
      setSelectedStudent('');
      if (onSuccess) onSuccess();
    } catch (error) {
      notify('Lỗi: ' + (error.response?.data?.error || error.message), 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Chỉ định lớp trưởng</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {currentLeader && (
          <Alert variant="info" className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Lớp trưởng hiện tại:</strong> {currentLeader.name} ({currentLeader.student_code})
            </div>
            <Button 
              size="sm" 
              variant="outline-danger" 
              onClick={handleRemove}
              disabled={loading}
            >
              Bỏ chỉ định
            </Button>
          </Alert>
        )}

        <Form.Group>
          <Form.Label>Chọn sinh viên làm lớp trưởng:</Form.Label>
          <Form.Select 
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Chọn sinh viên --</option>
            {students.map(student => (
              <option key={student.student_code} value={student.student_code}>
                {student.name} ({student.student_code})
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <div className="mt-3 text-muted small">
          <i className="bi bi-info-circle me-1"></i>
          Lớp trưởng có thể xem và sửa điểm của các sinh viên trong lớp, nhưng không có quyền duyệt điểm.
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Hủy
        </Button>
        <Button 
          variant="primary" 
          onClick={handleAssign}
          disabled={loading || !selectedStudent}
        >
          {loading ? 'Đang xử lý...' : 'Chỉ định'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AssignClassLeaderModal;
