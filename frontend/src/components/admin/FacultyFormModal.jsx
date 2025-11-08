import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap'; // Import components
import useNotify from '../../hooks/useNotify'; 

const FacultyFormModal = ({ facultyToEdit, onSave, onClose }) => {
  const { notify } = useNotify(); 
  const [formData, setFormData] = useState({ code: '', name: '' });
  const [isSaving, setIsSaving] = useState(false); 
  const [show, setShow] = useState(true); // State để React-Bootstrap quản lý Modal

  // Populate form
  useEffect(() => {
    if (facultyToEdit) {
      setFormData({ code: facultyToEdit.code || '', name: facultyToEdit.name || '' });
    } else {
      setFormData({ code: '', name: '' });
    }
  }, [facultyToEdit]);

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
      await onSave(formData, facultyToEdit?.id);
      handleClose();
    } catch (error) {
      console.error("Save faculty failed in modal:", error);
    } finally {
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
        <Modal.Title>{facultyToEdit ? 'Edit Faculty' : 'Add New Faculty'}</Modal.Title>
      </Modal.Header>
      
      <Form onSubmit={handleSave}>
        <Modal.Body>
          {/* Faculty Code Input */}
          <Form.Group className="mb-3">
            <Form.Label htmlFor="code">Faculty Code *</Form.Label>
            <Form.Control
              type="text"
              id="code"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required 
              disabled={isSaving}
              maxLength={10}
            />
          </Form.Group>
          {/* Faculty Name Input */}
          <Form.Group className="mb-3">
            <Form.Label htmlFor="name">Faculty Name *</Form.Label>
            <Form.Control
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={isSaving}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? <><Spinner animation="border" size="sm" className="me-1" /> Saving...</> : 'Save'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default FacultyFormModal;