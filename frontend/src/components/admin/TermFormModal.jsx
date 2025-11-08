import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Row, Col, Spinner } from 'react-bootstrap'; // Import components

const TermFormModal = ({ termToEdit, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    code: '', title: '', year: new Date().getFullYear(), semester: 1,
    start_date: '', end_date: '', is_active: true, is_assessment_open: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [show, setShow] = useState(true); // State để React-Bootstrap quản lý Modal

  // Điền dữ liệu vào form
  useEffect(() => {
    if (termToEdit) {
      setFormData({
        code: termToEdit.code || '',
        title: termToEdit.title || '',
        year: termToEdit.year || new Date().getFullYear(),
        semester: termToEdit.semester || 1,
        start_date: termToEdit.start_date?.split('T')[0] || '',
        end_date: termToEdit.end_date?.split('T')[0] || '',
        is_active: termToEdit.is_active !== undefined ? termToEdit.is_active : true,
        is_assessment_open: termToEdit.is_assessment_open !== undefined ? termToEdit.is_assessment_open : true,
      });
    } else {
      const currentYear = new Date().getFullYear();
      setFormData({
        code: '', title: '', year: currentYear, semester: 1,
        start_date: '', end_date: '', is_active: true, is_assessment_open: true
      });
    }
  }, [termToEdit]);

  // Hàm xử lý đóng Modal (khi bấm ESC, backdrop, hoặc nút đóng)
  const handleClose = () => setShow(false);
  
  // Hàm này được gọi sau khi Modal đã ẩn hoàn toàn
  const handleExited = () => {
    onClose(); // Báo cho component cha gỡ bỏ Modal component
  };

  // Cập nhật state formData khi người dùng thay đổi input
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = value;
    if (name === 'year' || name === 'semester') val = parseInt(value) || '';
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : val }));
  };

  // Xử lý khi bấm nút "Lưu"
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
       const dataToSend = { ...formData };
       if (!dataToSend.start_date) delete dataToSend.start_date;
       if (!dataToSend.end_date) delete dataToSend.end_date;

      await onSave(dataToSend, termToEdit?.code); 
      handleClose(); // Tự động đóng nếu thành công
    } catch (error) {
      console.error("Save term failed:", error); 
      setIsSaving(false); 
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      onExited={handleExited}
      backdrop="static" // Thay thế data-bs-backdrop="static"
      keyboard={false} // Thay thế data-bs-keyboard="false"
    >
      <Modal.Header closeButton>
        <Modal.Title>{termToEdit ? 'Sửa Học kỳ' : 'Thêm Học kỳ'}</Modal.Title>
      </Modal.Header>
      
      {/* Dùng Form component của React-Bootstrap */}
      <Form onSubmit={handleSave}>
        <Modal.Body>
          {/* Mã học kỳ */}
          <Form.Group className="mb-3">
            <Form.Label>Mã Học kỳ * <small>(vd: 2025HK1)</small></Form.Label>
            <Form.Control type="text" name="code" value={formData.code} onChange={handleChange} required disabled={!!termToEdit || isSaving} maxLength={10} />
          </Form.Group>
          {/* Tên học kỳ */}
          <Form.Group className="mb-3">
            <Form.Label>Tên Học kỳ * <small>(vd: Học kỳ 1 Năm học 2025-2026)</small></Form.Label>
            <Form.Control type="text" name="title" value={formData.title} onChange={handleChange} required disabled={isSaving} />
          </Form.Group>
          {/* Năm học và Học kỳ */}
          <Row className="g-2 mb-3">
            <Col md={6}>
              <Form.Group>
                  <Form.Label>Năm bắt đầu *</Form.Label>
                  <Form.Control type="number" name="year" value={formData.year} onChange={handleChange} required disabled={isSaving} min="2000" max="2100"/>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                  <Form.Label>Học kỳ *</Form.Label>
                  <Form.Select name="semester" value={formData.semester} onChange={handleChange} required disabled={isSaving}>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>Hè (3)</option>
                  </Form.Select>
              </Form.Group>
            </Col>
          </Row>
           {/* Ngày bắt đầu và kết thúc */}
           <Row className="g-2 mb-3">
             <Col md={6}>
                <Form.Group>
                  <Form.Label>Ngày bắt đầu</Form.Label>
                  <Form.Control type="date" name="start_date" value={formData.start_date} onChange={handleChange} disabled={isSaving} />
                </Form.Group>
             </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Ngày kết thúc</Form.Label>
                  <Form.Control type="date" name="end_date" value={formData.end_date} onChange={handleChange} disabled={isSaving} />
                </Form.Group>
             </Col>
           </Row>
          {/* Checkbox trạng thái */}
          <Form.Check 
            type="checkbox" 
            id="is_active" 
            name="is_active" 
            label="Học kỳ đang hoạt động" 
            checked={formData.is_active} 
            onChange={handleChange} 
            disabled={isSaving}
            className="mb-2"
          />
           <Form.Check 
            type="checkbox" 
            id="is_assessment_open" 
            name="is_assessment_open" 
            label="Cho phép sinh viên đánh giá" 
            checked={formData.is_assessment_open} 
            onChange={handleChange} 
            disabled={isSaving}
            className="mb-3"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>Hủy</Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? <><Spinner animation="border" size="sm" className="me-1" /> Đang lưu...</> : 'Lưu'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default TermFormModal;