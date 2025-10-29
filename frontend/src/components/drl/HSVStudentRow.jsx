import React, { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import useNotify from '../../hooks/useNotify';
import { confirmHSVAssessment } from '../../services/drlService';

const HSVStudentRow = ({ student, term }) => {
  const { user } = useAuth();
  const { notify } = useNotify();

  // State nội bộ cho từng dòng
  const [isChecked, setIsChecked] = useState(false);
  const [note, setNote] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [score21, setScore21] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Khởi tạo state khi component được tải
  useEffect(() => {
    setIsChecked((student.score_21 || 0) > 0);
    setScore21(student.score_21 || 0);
    setIsVerified(student.verified || false);
    // Ưu tiên ghi chú của HSV, nếu không có thì dùng ghi chú (SV request)
    setNote(student.hsv_note || student.request_note || '');
  }, [student]);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      const res = await confirmHSVAssessment(
        student.student_code,
        term,
        isChecked, // Giá trị state hiện tại của checkbox
        note,      // Giá trị state hiện tại của ô Ghi chú
        user.username
      );
      
      // Cập nhật lại state sau khi lưu thành công
      setScore21(res.score); // Cập nhật điểm 2.1
      setIsVerified(true);   // Chuyển sang "Đã xác nhận"
      notify('Đã cập nhật thành công!');

    } catch (e) {
      notify('Lỗi: ' + e.message, 'danger');
    }
    setIsSaving(false);
  };

  // Placeholder động giống file HTML gốc
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
          {/* Checkbox này được quản lý bởi React state */}
          <input 
            type="checkbox" 
            className="form-check-input" 
            style={{ transform: 'scale(1.2)' }}
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
          />
          {/* 2 Nút bấm nhanh */}
          <div className="btn-group btn-group-sm d-none d-md-inline-flex">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsChecked(false)}>Chưa</button>
            <button type="button" className="btn btn-outline-success" onClick={() => setIsChecked(true)}>Tham gia</button>
          </div>
        </div>
      </td>
      <td>
        {/* Input này cũng được quản lý bởi React state */}
        <input 
          type="text" 
          className="form-control"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={notePlaceholder}
        />
      </td>
      <td className="text-end" style={{ minWidth: '160px' }}>
        {isVerified ? (
          <span className="badge bg-success me-2 state-badge">Đã xác nhận</span>
        ) : (
          <span className="badge bg-secondary me-2 state-badge">Chưa</span>
        )}
        <button 
          className="btn btn-sm btn-main actConfirm"
          onClick={handleConfirm}
          disabled={isSaving}
        >
          {isSaving ? 'Đang lưu...' : (isVerified ? 'Cập nhật' : 'Xác nhận')}
        </button>
      </td>
    </tr>
  );
};

export default HSVStudentRow;