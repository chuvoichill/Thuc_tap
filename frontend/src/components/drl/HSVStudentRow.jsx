import React, { useState, useEffect } from 'react';
import { Form, InputGroup, Button, Badge, Spinner } from 'react-bootstrap'; // Import components
import useAuth from '../../hooks/useAuth';
import useNotify from '../../hooks/useNotify';
import { confirmHSVAssessment } from '../../services/drlService';

const HSVStudentRow = ({ student, term }) => {
  const { user } = useAuth();
  const { notify } = useNotify();

  const [isChecked, setIsChecked] = useState(false);
  const [note, setNote] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [score21, setScore21] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsChecked((student.score_21 || 0) > 0);
    setScore21(student.score_21 || 0);
    setIsVerified(student.verified || false);
    setNote(student.hsv_note || student.request_note || '');
  }, [student]);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      const res = await confirmHSVAssessment(
        student.student_code,
        term,
        isChecked,
        note,
        user.username
      );
      
      setScore21(res.score);
      setIsVerified(true);
      notify('Đã cập nhật thành công!');

    } catch (e) {
      notify('Lỗi: ' + e.message, 'danger');
    }
    setIsSaving(false);
  };

  const notePlaceholder = student.request_note 
    ? `SV: ${student.request_note}` 
    : 'HSV nhập ghi chú...';

  return (
    <tr>
      <td>{student.student_code}</td>
      <td>{student.full_name}</td>
      <td className="text-center fw-bold">{score21}</td>
      <td className="text-center">
        <div className="d-flex align-items-center justify-content-center gap-2">
          {/* Dùng Form.Check */}
          <Form.Check 
            type="checkbox" 
            style={{ transform: 'scale(1.2)' }}
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
          />
          {/* Dùng Button.Group */}
          <div className="btn-group btn-group-sm d-none d-md-inline-flex">
            <Button variant="outline-secondary" size="sm" onClick={() => setIsChecked(false)}>Chưa</Button>
            <Button variant="outline-success" size="sm" onClick={() => setIsChecked(true)}>Tham gia</Button>
          </div>
        </div>
      </td>
      <td>
        {/* Dùng Form.Control */}
        <Form.Control 
          type="text" 
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={notePlaceholder}
        />
      </td>
      <td className="text-end" style={{ minWidth: '160px' }}>
        {/* Dùng Badge */}
        {isVerified ? (
          <Badge bg="success" className="me-2 state-badge">Đã xác nhận</Badge>
        ) : (
          <Badge bg="secondary" className="me-2 state-badge">Chưa</Badge>
        )}
        {/* Dùng Button */}
        <Button 
          variant="success" // Thay btn-main bằng variant thích hợp, ví dụ success
          size="sm"
          onClick={handleConfirm}
          disabled={isSaving}
        >
          {isSaving ? <Spinner animation="border" size="sm" /> : (isVerified ? 'Cập nhật' : 'Xác nhận')}
        </Button>
      </td>
    </tr>
  );
};

export default HSVStudentRow;