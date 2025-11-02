import React, { useState, useEffect, useMemo } from 'react';

// Component con cho từng loại tiêu chí
const CriterionRow = ({ c, saved, onChange, readOnly }) => {
  const is21 = c.code === '2.1';
  const lock21 = is21 && saved.is_hsv_verified === true;

  // Xử lý tiêu chí 2.1 (giữ nguyên)
  if (is21) {
    if (lock21) { /* ... code render 2.1 bị khóa ... */
      const note = saved.hsv_note || saved.text_value || '';
      return (
        <>
          <div className="muted-note mb-1"><i className="bi bi-lock me-1"></i>Đã được HSV xác nhận.</div>
          <div className="input-group input-group-sm"> {/* input-group-sm */}
            <span className="input-group-text">Kết quả</span>
            <input className="form-control form-control-sm" value={`${(saved.self_score || 0) > 0 ? 'Có' : 'Không'} (điểm ${saved.self_score || 0})`} disabled />
            <span className="input-group-text">Ghi chú HSV</span>
            <input className="form-control form-control-sm" value={note} disabled />
          </div>
        </>
      );
    } else { /* ... code render 2.1 cho SV nhập ... */
      return (
        <>
          <div className="muted-note mb-1"><i className="bi bi-info-circle me-1"></i>SV ghi mô tả, HSV sẽ xác nhận.</div>
          <textarea
            className="form-control form-control-sm" // form-control-sm
            rows="2"
            placeholder="VD: Tham gia Chiến dịch Mùa hè Xanh..."
            value={saved.text_value || ''}
            disabled={readOnly}
            onChange={(e) => onChange(c.id, { text_value: e.target.value, self_score: 0, option_id: null })}
          />
        </>
      );
    }
  }

  // Xử lý tiêu chí loại 'radio' (giữ nguyên)
  if (c.type === 'radio') {
    return (c.options || []).map((opt, j) => (
      <div className="form-check" key={opt.id}>
        <input
          className="form-check-input"
          type="radio"
          name={`q${c.id}`}
          id={`q${c.id}_${j}`}
          value={opt.id}
          checked={Number(saved.option_id) === Number(opt.id)}
          disabled={readOnly}
          onChange={() => onChange(c.id, { option_id: opt.id, self_score: opt.score, text_value: null })}
        />
        <label className="form-check-label" htmlFor={`q${c.id}_${j}`}>
          {opt.label}
        </label>
      </div>
    ));
  }

  // --- SỬA LỖI Ở ĐÂY: Chuyển input thành textarea cho loại 'text' ---
  if (c.type === 'text') {
    return (
      // Thay <input> bằng <textarea>
      <textarea
        className="form-control form-control-sm" // Thêm form-control-sm cho nhất quán
        value={saved.text_value || ''}
        placeholder="Nhập nội dung/ghi chú (nếu có)..." // Placeholder rõ hơn
        disabled={readOnly}
        onChange={(e) => onChange(c.id, { text_value: e.target.value, self_score: 0, option_id: null })}
        rows="2" // Đặt số dòng mặc định
      ></textarea>
    );
  }
  // --- HẾT SỬA ---

  return null; // Loại tiêu chí không xác định
};


// Component Form chính (logic giữ nguyên)
const AssessmentForm = ({ criteria, selfData, onSubmit, isSaving, readOnly = false }) => {
  const [formState, setFormState] = useState({});

  const selfMap = useMemo(() => { /* ... giữ nguyên ... */
    return Object.fromEntries((selfData || []).map(r => [
   r.criterion_id,
   { ...r, self_score: r.self_score ?? r.score ?? 0 }
 ])); // Thêm || [] để tránh lỗi nếu selfData null/undefined
  }, [selfData]);

  useEffect(() => { /* ... giữ nguyên ... */
    setFormState(selfMap);
  }, [selfMap]);

  const totalScore = useMemo(() => { /* ... giữ nguyên ... */
    return Object.values(formState)
      .reduce((sum, item) => sum + (Number(item.self_score) || 0), 0);
  }, [formState]);

  const handleChange = (criterion_id, data) => { /* ... giữ nguyên ... */
    const c = criteria.find(cr => cr.id === criterion_id);
    // Tiêu chí 2.1 SV chỉ nhập text, điểm = 0 (trừ khi đã bị HSV khóa)
    if (c?.code === '2.1' && !readOnly && !formState[criterion_id]?.is_hsv_verified) {
    data.self_score = 0;
   }
    setFormState(prev => ({
      ...prev,
      [criterion_id]: { ...(prev[criterion_id] || {}), criterion_id: criterion_id, ...data }
    }));
  };

  const handleSubmit = (e) => { /* ... giữ nguyên ... */
    e.preventDefault();
    const items = criteria
      .map(c => {
        const state = formState[c.id];
        if (!state) return null;
        // Không gửi mục 2.1 đã bị HSV khóa (trừ khi backend cho phép cập nhật text_value?)
        // Hiện tại logic backend (saveSelfAssessment) đã chặn update 2.1 nếu is_hsv_verified=true
        // if (c.code === '2.1' && state.is_hsv_verified) return null;

        // Chỉ gửi những trường cần thiết
        return {
          criterion_id: c.id,
          option_id: state.option_id || null,
          text_value: state.text_value || null,
          // Tính lại score dựa trên option đã chọn (nếu là radio) để đảm bảo đúng
          // Hoặc dựa vào state.self_score nếu tin tưởng state
          score: state.self_score || 0 // Tạm thời vẫn dùng state.self_score
        };
      })
      .filter(Boolean);
    // Chỉ gọi onSubmit nếu nó được truyền vào (trang Xem lại không có onSubmit)
    if(onSubmit) {
       onSubmit(items, totalScore);
    }
  };

  let lastGrp = null;

  return (
    <form onSubmit={handleSubmit}>
      <div className="table-responsive" style={{ maxHeight: '65vh' }}>
        <table className="table table-bordered table-sm align-middle"> {/* Thêm table-sm */}
          <thead>
            <tr className="text-center bg-success text-white">
              <th style={{ width: '50px' }}>STT</th> {/* Thu nhỏ STT */}
              <th>Nội dung tiêu chí</th>
              <th style={{ width: '100px' }}>Điểm tối đa</th> {/* Thu nhỏ điểm max */}
            </tr>
          </thead>
          <tbody>
            {(criteria || []).map((c, i) => { // Thêm || [] để tránh lỗi
              const isNewGroup = c.grp_order != null && c.grp_order !== lastGrp;
              if (isNewGroup) lastGrp = c.grp_order;
              const saved = formState[c.id] || {}; // Lấy dữ liệu từ state (đã đồng bộ)

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
                      <div className="fw-semibold mb-1 small">{c.code || ''} {c.title || ''}</div> {/* Giảm cỡ chữ tiêu đề */}
                      {/* Component CriterionRow sẽ render input/radio/textarea tương ứng */}
                      <CriterionRow
                        c={c}
                        saved={saved}
                        onChange={handleChange} // Truyền hàm xử lý thay đổi
                        readOnly={readOnly} // Truyền trạng thái chỉ đọc
                      />
                    </td>
                    <td className="text-center">{c.max_points}</td>
                  </tr>
                </React.Fragment>
              );
            })}
             {/* Thêm thông báo nếu không có tiêu chí */}
             {(!criteria || criteria.length === 0) && (
                <tr><td colSpan="3" className="text-center text-muted py-3">Không có tiêu chí nào cho kỳ học này.</td></tr>
             )}
          </tbody>
        </table>
      </div>

      {/* Phần Tổng điểm và Nút bấm */}
      <div className="mt-3 d-flex justify-content-between align-items-center">
        <div>
          <span className="text-muted">Tổng điểm:</span>
          <span id="sumPoints" className="fw-bold fs-5 ms-2">{totalScore}</span>
        </div>
        {/* Chỉ hiển thị nút Gửi nếu không ở chế độ chỉ đọc và có hàm onSubmit */}
        {!readOnly && onSubmit && (
          <button
            className="btn btn-main"
            type="submit"
            disabled={isSaving} // Disable nút khi đang lưu
          >
            {isSaving ? ( // Hiển thị spinner khi đang lưu
              <><span className="spinner-border spinner-border-sm me-1"></span> Đang lưu...</>
            ) : ( // Hiển thị icon và text bình thường
              <><i className="bi bi-send-check me-1"></i> Gửi đánh giá</>
            )}
          </button>
        )}
      </div>
    </form>
  );
};

export default AssessmentForm;