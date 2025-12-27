import React, { useState, useEffect, useMemo } from 'react';
import { Table, Form, Button, Spinner, Badge, Modal } from 'react-bootstrap';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

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
const AssessmentForm = ({ criteria, selfData, onSubmit, isSaving, readOnly = false, page, studentCode, termCode, noted }) => {
  const [formState, setFormState] = useState({});
  const [note, setNote] = useState(noted || ''); // State để lưu ghi chú cho từng sinh viên
  const [evidenceFiles, setEvidenceFiles] = useState({}); // State lưu file minh chứng
  const [uploadingEvidence, setUploadingEvidence] = useState({}); // Track upload progress
  const [existingEvidence, setExistingEvidence] = useState({}); // Lưu file đã upload
  const [previewImage, setPreviewImage] = useState(null); // State cho modal xem ảnh
  const [showImageModal, setShowImageModal] = useState(false); // State hiển thị modal
  const selfMap = useMemo(() => {
    return Object.fromEntries((selfData || []).map(r => [
      r.criterion_id,
      { ...r, self_score: r.self_score ?? r.score ?? 0 }
    ]));
  }, [selfData]);

  useEffect(() => {
    setFormState(selfMap);
    // Load existing evidence for criteria that require it
    if (studentCode && termCode) {
      loadExistingEvidence();
    }
  }, [selfMap, studentCode, termCode]);

  const loadExistingEvidence = async () => {
    if (!studentCode || !termCode) return;
    
    const criteriaWithEvidence = criteria.filter(c => c.requires_evidence);
    const evidenceData = {};
    
    for (const criterion of criteriaWithEvidence) {
      try {
        const token = JSON.parse(localStorage.getItem('auth'))?.token;
        const response = await axios.get(`${API_BASE}/api/drl/evidence`, {
          params: {
            student_code: studentCode,
            term_code: termCode,
            criterion_id: criterion.id
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data && response.data.length > 0) {
          evidenceData[criterion.id] = response.data;
        }
      } catch (error) {
        console.error(`Lỗi load minh chứng cho tiêu chí ${criterion.id}:`, error);
      }
    }
    
    setExistingEvidence(evidenceData);
  };

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

  const handleEvidenceChange = async (criterion_id, files) => {
    if (!files || files.length === 0) return;
    
    setUploadingEvidence(prev => ({ ...prev, [criterion_id]: true }));
    
    try {
      const formData = new FormData();
      formData.append('student_code', studentCode);
      formData.append('term_code', termCode);
      formData.append('criterion_id', criterion_id);
      
      Array.from(files).forEach(file => {
        formData.append('evidence', file);
      });
      
      const token = JSON.parse(localStorage.getItem('auth'))?.token;
      const response = await axios.post(
        `${API_BASE}/api/drl/evidence/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      // Cập nhật danh sách file đã upload
      setExistingEvidence(prev => ({
        ...prev,
        [criterion_id]: [...(prev[criterion_id] || []), ...response.data.files]
      }));
      
      // Clear file input
      setEvidenceFiles(prev => ({ ...prev, [criterion_id]: null }));
      
    } catch (error) {
      console.error('Lỗi upload minh chứng:', error);
      alert('Lỗi khi upload file: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploadingEvidence(prev => ({ ...prev, [criterion_id]: false }));
    }
  };

  const handleDeleteEvidence = async (criterion_id, evidenceId) => {
    if (!window.confirm('Xóa file minh chứng này?')) return;
    
    try {
      const token = JSON.parse(localStorage.getItem('auth'))?.token;
      await axios.delete(`${API_BASE}/api/drl/evidence/${evidenceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Cập nhật UI
      setExistingEvidence(prev => ({
        ...prev,
        [criterion_id]: (prev[criterion_id] || []).filter(e => e.id !== evidenceId)
      }));
      
    } catch (error) {
      console.error('Lỗi xóa minh chứng:', error);
      alert('Lỗi khi xóa file: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleViewImage = (imageUrl) => {
    setPreviewImage(imageUrl);
    setShowImageModal(true);
  };

  const handleCloseImageModal = () => {
    setShowImageModal(false);
    setPreviewImage(null);
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
      <div className="table-responsive" style={{ maxHeight: page=="SelfAssessmentPage" ? '70vh' : '55vh'   }}>
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

                      {/* Hiển thị upload ảnh nếu tiêu chí yêu cầu minh chứng */}
                      {c.requires_evidence && (
                        <div className="mt-2">
                          <div className="small fw-semibold mb-1">Minh chứng:</div>
                          
                          {/* Hiển thị ảnh đã upload */}
                          {existingEvidence[c.id] && existingEvidence[c.id].length > 0 && (
                            <div className="d-flex flex-wrap gap-2 mb-2">
                              {existingEvidence[c.id].map((evidence) => (
                                <div 
                                  key={evidence.id} 
                                  className="position-relative border rounded bg-light p-1"
                                  style={{ width: '120px', height: '140px' }}
                                >
                                  <div 
                                    className="d-flex align-items-center justify-content-center bg-white border"
                                    style={{ 
                                      width: '100%', 
                                      height: '100px',
                                      overflow: 'hidden',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => handleViewImage(`${API_BASE}/api/uploads/evidence/${evidence.file_url}`)}
                                  >
                                    <img
                                      src={`${API_BASE}/api/uploads/evidence/${evidence.file_url}`}
                                      alt="Minh chứng"
                                      style={{ 
                                        width: '100%', 
                                        height: '100%', 
                                        objectFit: 'cover'
                                      }}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.innerHTML = '<i class="bi bi-image text-muted" style="font-size: 2rem"></i>';
                                      }}
                                    />
                                  </div>
                                  {!readOnly && (
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      className="position-absolute"
                                      style={{ 
                                        padding: '2px 6px', 
                                        fontSize: '0.75rem',
                                        top: '2px',
                                        right: '2px'
                                      }}
                                      onClick={() => handleDeleteEvidence(c.id, evidence.id)}
                                    >
                                      <i class="fa-solid fa-trash-can"></i>
                                    </Button>
                                  )}
                                  <div className="text-center mt-1">
                                    <Badge bg="info" className="small">
                                      {evidence.file_type?.split('/')[1]?.toUpperCase() || 'IMG'}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Input upload file mới - chỉ hiển thị khi không ở chế độ readOnly */}
                          {!readOnly && (
                            <>
                              <Form.Control
                                type="file"
                                size="sm"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleEvidenceChange(c.id, e.target.files)}
                                disabled={uploadingEvidence[c.id]}
                              />
                              
                              {uploadingEvidence[c.id] && (
                                <div className="small text-primary mt-1">
                                  <Spinner animation="border" size="sm" className="me-1" />
                                  Đang upload...
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
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
      {(page === 'teacher' || page === 'class_leader' || page === 'faculty' || page === 'admin') && (
        <div >
          <div className="fw-semibold mt-2">Ghi chú</div>
          <Form.Control as="textarea" value={note} placeholder='...' size='sm' style={{ width: "100%" }} onChange={(e)=>(setNote(e.target.value))}></Form.Control>
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

      {/* Modal xem ảnh phóng to */}
      <Modal show={showImageModal} onHide={handleCloseImageModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Xem minh chứng</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {previewImage && (
            <img 
              src={previewImage} 
              alt="Preview" 
              style={{ maxWidth: '100%', maxHeight: '80vh' }}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseImageModal}>
            Đóng
          </Button>
          <Button 
            variant="primary" 
            as="a" 
            href={previewImage} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <i className="bi bi-box-arrow-up-right me-1"></i>
            Mở tab mới
          </Button>
        </Modal.Footer>
      </Modal>
    </Form>
  );
};

export default AssessmentForm;