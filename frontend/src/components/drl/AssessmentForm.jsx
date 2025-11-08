import React, { useState, useEffect, useMemo } from 'react';
import { Table, Form, Button, InputGroup, Spinner, Alert } from 'react-bootstrap'; // Import components

// Component con cho từng loại tiêu chí
const CriterionRow = ({ c, saved, onChange, readOnly }) => {
  const is21 = c.code === '2.1';
  const lock21 = is21 && saved.is_hsv_verified === true;

  // Xử lý tiêu chí 2.1
  if (is21) {
    if (lock21) {
      const note = saved.hsv_note || saved.text_value || '';
      return (
        <>
          <div className="muted-note mb-1 small text-muted"><i className="bi bi-lock me-1"></i>Đã được HSV xác nhận.</div>
          {/* Thay thế div.input-group.input-group-sm bằng InputGroup size="sm" */}
          <InputGroup size="sm">
            <InputGroup.Text>Kết quả</InputGroup.Text>
            <Form.Control value={`${(saved.self_score || 0) > 0 ? 'Có' : 'Không'} (điểm ${saved.self_score || 0})`} disabled />
            <InputGroup.Text>Ghi chú HSV</InputGroup.Text>
            <Form.Control value={note} disabled />
          </InputGroup>
        </>
      );
    } else {
      return (
        <>
          <div className="muted-note mb-1 small text-muted"><i className="bi bi-info-circle me-1"></i>SV ghi mô tả, HSV sẽ xác nhận.</div>
          <Form.Control
            as="textarea" // Dùng Form.Control với as="textarea"
            rows={2}
            size="sm" // Thêm size="sm"
            placeholder="VD: Tham gia Chiến dịch Mùa hè Xanh..."
            value={saved.text_value || ''}
            disabled={readOnly}
            onChange={(e) => onChange(c.id, { text_value: e.target.value, self_score: 0, option_id: null })}
          />
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
const AssessmentForm = ({ criteria, selfData, onSubmit, isSaving, readOnly = false }) => {
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
    const c = criteria.find(cr => cr.id === criterion_id);
    if (c?.code === '2.1' && !readOnly && !formState[criterion_id]?.is_hsv_verified) {
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
      <div className="table-responsive" style={{ maxHeight: '65vh' }}>
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
            variant="success" // Thay btn-main bằng variant thích hợp, ví dụ success
            type="submit"
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