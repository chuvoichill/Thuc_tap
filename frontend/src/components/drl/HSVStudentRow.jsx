import React, { useState, useEffect } from 'react';
import { Form, Button, Badge, Spinner } from 'react-bootstrap';
import useAuth from '../../hooks/useAuth';
import useNotify from '../../hooks/useNotify';
import { confirmHSVAssessment, unconfirmHSVAssessment } from '../../services/drlService';

const HSVStudentRow = ({ student, term, onUpdate }) => {
  const { user } = useAuth();
  const { notify } = useNotify();

  const criterionType = student.criterion_type || 'text';
  const options = student.options || [];
  
  // State cho type = text (checkbox Có/Không)
  const [isChecked, setIsChecked] = useState(false);
  
  // State cho type = radio (selected option)
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  
  const [note, setNote] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Khởi tạo state dựa trên type
    if (criterionType === 'radio') {
      setSelectedOptionId(student.option_id || null);
    } else {
      setIsChecked((student.self_score || 0) > 0);
    }
    
    setCurrentScore(student.self_score || 0);
    setIsVerified(student.is_hsv_verified || false);
    setNote(student.hsv_note || '');
  }, [student, criterionType]);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      // Xác định participated dựa trên type
      let participated = false;
      
      if (criterionType === 'radio') {
        // Nếu type = radio, kiểm tra có chọn option không
        participated = selectedOptionId != null;
      } else {
        // Nếu type = text, lấy từ checkbox
        participated = isChecked;
      }
       
      const res = await confirmHSVAssessment(
        student.student_code,
        term,
        student.criterion_code,
        participated,
        note,
        user.username
      );
      
      setCurrentScore(res.score);
      setIsVerified(true);
      notify('✅ Đã xác nhận thành công!', 'success');
      
      // ✅ Optimistic update - Chỉ cập nhật row này
      if (onUpdate) {
        onUpdate(student.student_code, student.criterion_code, {
          self_score: res.score,
          is_hsv_verified: true,
          hsv_note: note
        });
      }

    } catch (e) {
      notify('❌ Lỗi: ' + e.message, 'danger');
    }
    setIsSaving(false);
  };

  // ✅ Thêm hàm bỏ xác nhận
  const handleUnverify = async () => {
    if (!window.confirm('Bạn có chắc muốn BỎ xác nhận cho tiêu chí này?')) return;
    
    setIsSaving(true);
    try {
      await unconfirmHSVAssessment(
        student.student_code,
        term,
        student.criterion_code
      );
      
      setCurrentScore(0);
      setIsVerified(false);
      setIsChecked(false);
      setSelectedOptionId(null);
      setNote('');
      notify('🔄 Đã bỏ xác nhận', 'info');
      
      if (onUpdate) {
        onUpdate(student.student_code, student.criterion_code, {
          self_score: 0,
          is_hsv_verified: false,
          hsv_note: ''
        });
      }

    } catch (e) {
      notify('❌ Lỗi: ' + e.message, 'danger');
    }
    setIsSaving(false);
  };

  const renderStudentInput = () => {
    if (criterionType === 'radio') {
      // Ưu tiên hiển thị: selectedOptionId (HSV đang chọn) > student.option_id (SV đã chọn)
      // Nhưng chỉ dùng selectedOptionId nếu khác với student.option_id (HSV đã thay đổi)
      const displayOptionId = (selectedOptionId !== null && selectedOptionId !== student.option_id) 
        ? selectedOptionId 
        : student.option_id;
      
      // So sánh với == thay vì === để tránh lỗi string vs number
      // eslint-disable-next-line eqeqeq
      const selectedOption = options.find(opt => opt.id == displayOptionId);
      
      return (
        <div>
          {selectedOption ? (
            <span className="small">{selectedOption.label}</span>
          ) : (
            <span className="text-muted fst-italic">(Chưa chọn)</span>
          )}
        </div>
      );
    } else {
      return student.text_value ? (
        <div className="small">{student.text_value}</div>
      ) : (
        <span className="text-muted fst-italic">(Chưa nhập)</span>
      );
    }
  };

  return (
    <tr >
      <td className="align-middle">
        <Badge bg="success">{student.criterion_code}</Badge>
        {student.criterion_title && (
          <div className="small text-muted mt-1">{student.criterion_title}</div>
        )}
      </td>
      <td className="text-center align-middle">
        <Badge bg='success' className="fs-6">
          {currentScore}
        </Badge>
      </td>
      <td className="align-middle">{renderStudentInput()}</td>
      
      <td className="align-middle">
        {criterionType === 'radio' ? (
          <Form.Select
            size="sm"
            value={selectedOptionId || ''}
            onChange={(e) => setSelectedOptionId(e.target.value ? Number(e.target.value) : null)}
            disabled={isVerified || isSaving}
          >
            <option value="">-- Chọn kết quả --</option>
            {options.map(opt => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({opt.score} đ)
              </option>
            ))}
          </Form.Select>
        ) : (
          <div className="text-center">
            <Form.Check 
              type="switch"
              id={`switch-${student.student_code}-${student.criterion_code}`}
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              disabled={isVerified || isSaving}
              className="custom-switch-green"
            />
          </div>
        )}
      </td>
      
      <td className="align-middle">
        <Form.Control 
          type="text" 
          size="sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú..."
          disabled={isVerified || isSaving}
        />
      </td>
      
      <td className="text-center align-middle">
        {isVerified ? (
          <div className="d-flex justify-content-end align-items-center gap-2">
            <Badge bg="success" className="d-flex align-items-center px-2">
              <i className="bi bi-check-circle-fill me-1"></i> Đã xác nhận
            </Badge>
            <Button 
              variant="outline-danger"
              size="sm"
              onClick={handleUnverify}
              disabled={isSaving}
              title="Bỏ xác nhận"
            >
              <i className="bi bi-x-circle"></i> Bỏ
            </Button>
          </div>
        ) : (
          <Button 
            variant="success"
            size="sm"
            onClick={handleConfirm}
            disabled={isSaving}
          >
            {isSaving ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <>
                <i className="bi bi-check-circle me-1"></i> Xác nhận
              </>
            )}
          </Button>
        )}
      </td>
    </tr>
  );
};

export default HSVStudentRow;