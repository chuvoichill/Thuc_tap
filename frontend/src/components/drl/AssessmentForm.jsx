import React, { useState, useEffect, useMemo } from 'react';
import { Table, Form, Button, InputGroup, Spinner, Alert } from 'react-bootstrap'; // Import components

// Component con cho từng loại tiêu chí
const CriterionRow = ({ c, saved, onChange, readOnly }) => {
  // ✅ FIX: Dùng require_hsv_verify thay vì hardcode code === '2.1'
  const requiresHSV = c.require_hsv_verify === true;
  const isVerified = requiresHSV && saved.is_hsv_verified === true;

  // ✅ Xử lý tiêu chí CẦN HSV XÁC NHẬN
  if (requiresHSV) {
    // Case 1: Đã được HSV xác nhận
    if (isVerified) {
      const note = saved.hsv_note || '';
      return (
        <>
          <Alert variant="success" className="mb-2 py-2 small">
            <i className="bi bi-shield-check me-1"></i>
            <strong>Đã được HSV xác nhận</strong>
          </Alert>
          <InputGroup size="sm">
            <InputGroup.Text>Kết quả</InputGroup.Text>
            <Form.Control 
              value={`${(saved.self_score || 0) > 0 ? 'Có tham gia' : 'Không tham gia'} - ${saved.self_score || 0} điểm`} 
              disabled 
            />
          </InputGroup>
          {note && (
            <InputGroup size="sm" className="mt-1">
              <InputGroup.Text>Ghi chú HSV</InputGroup.Text>
              <Form.Control value={note} disabled />
            </InputGroup>
          )}
        </>
      );
    } 
    
    // Case 2: Chưa được HSV xác nhận - Hiển thị theo type
    else {
      return (
        <>
          <Alert variant="warning" className="mb-2 py-2 small">
            <i className="bi bi-shield-exclamation me-1"></i>
            Tiêu chí này cần <strong>HSV xác nhận</strong>. Điểm hiện tại = 0 (chờ xác nhận).
          </Alert>
          
          {/* Hiển thị input theo type của tiêu chí */}
          {c.type === 'radio' && (
            <div>
              {(c.options || []).map((opt, j) => (
                <Form.Check
                  type="radio"
                  key={opt.id}
                  name={`q${c.id}`}
                  id={`q${c.id}_${j}`}
                  label={`${opt.label} (sẽ chờ HSV xác nhận)`}
                  value={opt.id}
                  checked={Number(saved.option_id) === Number(opt.id)}
                  disabled={readOnly}
                  onChange={() => onChange(c.id, { option_id: opt.id, self_score: 0, text_value: null })}
                />
              ))}
            </div>
          )}
          
          {c.type === 'text' && (
            <Form.Control
              as="textarea"
              rows={2}
              size="sm"
              placeholder="VD: Tham gia CLB Lập Trình, vai trò Thành viên..."
              value={saved.text_value || ''}
              disabled={readOnly}
              onChange={(e) => onChange(c.id, { text_value: e.target.value, self_score: 0, option_id: null })}
            />
          )}
          
          <div className="text-muted small mt-1">
            Điểm: <strong>0</strong> / {c.max_points} (Chờ HSV xác nhận)
          </div>
        </>
      );
    }
  }

  // Xử lý tiêu chí loại 'radio'
  if (c.type === 'radio') {
    return (c.options || []).map((opt, j) => (
      <Form.Check // Dùng Form.Check cho radio buttons
        type="radio"
        key={opt.id}
        name={`q${c.id}`}
        id={`q${c.id}_${j}`}
        label={opt.label}
        value={opt.id}
        checked={Number(saved.option_id) === Number(opt.id)}
        disabled={readOnly}
        onChange={() => onChange(c.id, { option_id: opt.id, self_score: opt.score, text_value: null })}
      />
    ));
  }

  // Xử lý tiêu chí loại 'text'
  if (c.type === 'text') {
    return (
      <Form.Control // Dùng Form.Control với as="textarea"
        as="textarea"
        size="sm"
        value={saved.text_value || ''}
        placeholder="Nhập nội dung/ghi chú (nếu có)..."
        disabled={readOnly}
        onChange={(e) => onChange(c.id, { text_value: e.target.value, self_score: 0, option_id: null })}
        rows={2}
      />
    );
  }

  return null;
};


// Component Form chính
const AssessmentForm = ({ criteria, selfData, onSubmit, isSaving, readOnly = false, page }) => {
  const [formState, setFormState] = useState({});

  const selfMap = useMemo(() => {
    return Object.fromEntries((selfData || []).map(r => [
   r.criterion_id,
   { ...r, self_score: r.self_score ?? r.score ?? 0 }
 ]));
  }, [selfData]);

  useEffect(() => {
    setFormState(selfMap);
  }, [selfMap]);

  const totalScore = useMemo(() => {
    return Object.values(formState)
      .reduce((sum, item) => sum + (Number(item.self_score) || 0), 0);
  }, [formState]);

  const handleChange = (criterion_id, data) => {
    // ✅ FIX: Tìm tiêu chí và kiểm tra require_hsv_verify
    const c = criteria.find(cr => cr.id === criterion_id);
    
    // Nếu tiêu chí cần HSV xác nhận và chưa được xác nhận → Force điểm = 0
    if (c?.require_hsv_verify && !formState[criterion_id]?.is_hsv_verified) {
      data.self_score = 0;
    }
    
    setFormState(prev => ({
      ...prev,
      [criterion_id]: { ...(prev[criterion_id] || {}), criterion_id: criterion_id, ...data }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const items = criteria
      .map(c => {
        const state = formState[c.id];
        if (!state) return null;
        return {
          criterion_id: c.id,
          option_id: state.option_id || null,
          text_value: state.text_value || null,
          score: state.self_score || 0
        };
      })
      .filter(Boolean);
    if(onSubmit) {
       onSubmit(items, totalScore);
    }
  };

  let lastGrp = null;

  return (
    <Form onSubmit={handleSubmit}>
      {/* Thay thế div.table-responsive bằng Table responsive */}
      <div className="table-responsive"  style={{ maxHeight:!!page?'70vh':'auto' }}>
        <Table bordered size="sm" className="align-middle mb-0">
          <thead>
            <tr className="text-center table-success text-white">
              <th style={{ width: '50px' }}>STT</th>
              <th>Nội dung tiêu chí</th>
              <th style={{ width: '100px' }}>Điểm tối đa</th>
            </tr>
          </thead>
          <tbody>
            {(criteria || []).map((c, i) => {
              const isNewGroup = c.grp_order != null && c.grp_order !== lastGrp;
              if (isNewGroup) lastGrp = c.grp_order;
              const saved = formState[c.id] || {};

              return (
                <React.Fragment key={c.id}>
                  {isNewGroup && (
                    <tr className="table-success">
                      <td colSpan="3" className="fw-semibold">
                        {c.grp_order}. { `${c.group_title}`}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="text-center">{i + 1}</td>
                    <td>
                      <div className="fw-semibold mb-1 small">{c.code || ''} {c.title || ''}</div>
                      <CriterionRow
                        c={c}
                        saved={saved}
                        onChange={handleChange}
                        readOnly={readOnly}
                      />
                    </td>
                    <td className="text-center">{c.max_points}</td>
                  </tr>
                </React.Fragment>
              );
            })}
             {(!criteria || criteria.length === 0) && (
                <tr><td colSpan="3" className="text-center text-muted py-3">Không có tiêu chí nào cho kỳ học này.</td></tr>
             )}
          </tbody>
        </Table>
      </div>

      {/* Phần Tổng điểm và Nút bấm */}
      <div className="mt-3 d-flex justify-content-between align-items-center">
        <div>
          <span className="text-muted">Tổng điểm:</span>
          <span id="sumPoints" className="fw-bold fs-5 ms-2">{totalScore}</span>
        </div>
        {!readOnly && onSubmit && (
          <Button
            className="btn-main" // Thay btn-main bằng variant thích hợp, ví dụ success
            type="submit"
            variant='success'
            disabled={isSaving}
          >
            {isSaving ? (
              <><Spinner animation="border" size="sm" className="me-1" /> Đang lưu...</> // Dùng Spinner component
            ) : (
              <><i className="bi bi-send-check me-1"></i> Gửi đánh giá</>
            )}
          </Button>
        )}
      </div>
    </Form>
  );
};

export default AssessmentForm;