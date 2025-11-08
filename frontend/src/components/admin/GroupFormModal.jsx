import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap'; // Import components

const GroupFormModal = ({ groupToEdit, termCode, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    code: '', title: '', display_order: 99
  });
  const [isSaving, setIsSaving] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (groupToEdit) {
      setFormData({
        code: groupToEdit.code || '',
        title: groupToEdit.title || '',
        display_order: groupToEdit.display_order || 99,
      });
    } else {
      setFormData({ code: '', title: '', display_order: 99 });
    }
  }, [groupToEdit]);
  
  const handleClose = () => setShow(false);
  const handleExited = () => onClose();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const dataToSend = { ...formData, term_code: termCode }; 
      await onSave(dataToSend, groupToEdit?.id);
      handleClose(); // Tự động đóng nếu thành công
    } catch (error) { 
        // Lỗi đã được xử lý ở cha
    } 
    finally { 
        setIsSaving(false); 
    }
  };

  return (
    <Modal 
      show={show} 
      onHide={handleClose} 
      onExited={handleExited} 
      backdrop="static" 
      keyboard={false}
    >
      <Modal.Header closeButton>
        <Modal.Title>{groupToEdit ? 'Sửa Nhóm TC' : 'Thêm Nhóm TC'}</Modal.Title>
      </Modal.Header>
      
      <Form onSubmit={handleSave}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Học kỳ (Không đổi được)</Form.Label>
            <Form.Control type="text" value={termCode} disabled />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="code">Mã Nhóm * (vd: 1, 2, ...)</Form.Label>
            <Form.Control type="text" id="code" name="code" value={formData.code} onChange={handleChange} required disabled={isSaving} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="title">Tên Nhóm *</Form.Label>
            <Form.Control type="text" id="title" name="title" value={formData.title} onChange={handleChange} required disabled={isSaving} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="display_order">Thứ tự</Form.Label>
            <Form.Control type="number" id="display_order" name="display_order" value={formData.display_order} onChange={handleChange} disabled={isSaving} />
          </Form.Group>
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
export default GroupFormModal;