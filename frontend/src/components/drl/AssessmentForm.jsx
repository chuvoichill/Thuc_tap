import React, { useState, useEffect, useMemo } from 'react';
import { Table, Form, Button, Spinner } from 'react-bootstrap';

const CriterionRow = ({ c, saved, onChange, readOnly }) => {
  // Xử lý tiêu chí loại 'radio'
  if (c.type === 'radio') {
    return (c.options || []).map((opt, j) => (
      <Form.Check
        type="radio"
        key={opt.id}
        name={`q${c.id}`}
        id={`q${c.id}_${j}`}
        className="d-flex align-items-center"
        label={
          <span className="d-flex align-items-center">
            <span className='ms-2'>{opt.label}</span>
            <span className="text-muted ms-2" style={{ fontSize: "small", fontStyle: "italic" }}>
              ({opt.score} điểm)
            </span>
          </span>
        }
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
  const [note, setNote] = useState(''); // State để lưu ghi chú cho từng sinh viên

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
    if (onSubmit) {
      onSubmit(items, note);
    }
  };

  let lastGrp = null;

  return (
    <Form onSubmit={handleSubmit}>
      {/* Thay thế div.table-responsive bằng Table responsive */}
      <div className="table-responsive" style={{ maxHeight: !!page ? '70vh' : 'auto' }}>
        <Table bordered size="sm" className="align-middle mb-0">
          <thead>
            <tr className="text-center table-success text-white">

              <th>Nội dung tiêu chí</th>
              <th style={{ width: '100px' }}>Điểm tối đa</th>
            </tr>
          </thead>
          <tbody>
            {(criteria || []).map((c) => {
              const isNewGroup = c.grp_order != null && c.grp_order !== lastGrp;
              if (isNewGroup) lastGrp = c.grp_order;
              const saved = formState[c.id] || {};

              return (
                <React.Fragment key={c.id}>
                  {isNewGroup && (
                    <tr className="table-success">
                      <td colSpan="3" className="fw-semibold">
                        {c.grp_order}. {c.group_title}
                      </td>
                    </tr>
                  )}
                  <tr>

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
      {page === 'teacher' && (
        <div >
          <div className="fw-semibold mt-2">Ghi chú</div>
          <Form.Control as="textarea" placeholder='...' style={{ width: "100%" }} onChange={(e)=>(setNote(e.target.value))}></Form.Control>
        </div>
      )}
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
              <><i className="bi bi-send-check me-1"></i> Lưu đánh giá</>
            )}
          </Button>
        )}
      </div>
    </Form>
  );
};

export default AssessmentForm;