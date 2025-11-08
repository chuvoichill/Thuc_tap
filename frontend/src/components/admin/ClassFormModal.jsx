import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap'; // Import components
import useNotify from '../../hooks/useNotify';
import { getAllFacultiesSimple } from '../../services/drlService';

const ClassFormModal = ({ classToEdit, onSave, onClose }) => {
  const { notify } = useNotify();
  const [formData, setFormData] = useState({ code: '', name: '', faculty_id: '' });
  const [faculties, setFaculties] = useState([]);
  const [isLoadingFaculties, setIsLoadingFaculties] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [show, setShow] = useState(true); // State để React-Bootstrap quản lý Modal

  const handleClose = () => setShow(false);
  const handleExited = () => onClose();

  // Load faculties
  useEffect(() => {
    const fetchFaculties = async () => {
      setIsLoadingFaculties(true);
      try {
        const data = await getAllFacultiesSimple();
        setFaculties(data || []);
        if (!classToEdit && data && data.length > 0) {
          setFormData(prev => ({ ...prev, faculty_id: data[0].id }));
        }
      } catch (error) {
        notify('Could not load faculty list: ' + error.message, 'danger');
      }
      setIsLoadingFaculties(false);
    };
    fetchFaculties();
  }, [notify, classToEdit]);

  // Populate form
  useEffect(() => {
    if (classToEdit) {
      setFormData({
        code: classToEdit.code || '',
        name: classToEdit.name || '',
        faculty_id: classToEdit.faculty_id || '',
      });
    } else {
      setFormData(prev => ({
           ...prev,
           code: '',
           name: '',
       }));
    }
  }, [classToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData, classToEdit?.id);
      handleClose();
    } catch (error) {
      console.error("Save class failed in modal:", error);
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
        <Modal.Title>{classToEdit ? 'Edit Class' : 'Add New Class'}</Modal.Title>
      </Modal.Header>
      
      <Form onSubmit={handleSave}>
        <Modal.Body>
          {/* Class Code Input */}
          <Form.Group className="mb-3">
            <Form.Label htmlFor="code">Class Code *</Form.Label>
            <Form.Control
              type="text"
              id="code"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
              disabled={isSaving}
              maxLength={20}
            />
          </Form.Group>
          {/* Class Name Input */}
          <Form.Group className="mb-3">
            <Form.Label htmlFor="name">Class Name *</Form.Label>
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
          {/* Faculty Selection Dropdown */}
          <Form.Group className="mb-3">
            <Form.Label htmlFor="faculty_id">Faculty *</Form.Label>
            <Form.Select
              id="faculty_id"
              name="faculty_id"
              value={formData.faculty_id}
              onChange={handleChange}
              required
              disabled={isLoadingFaculties || isSaving}
            >
              {isLoadingFaculties ? (
                <option>Loading Faculties...</option>
              ) : (
                faculties.map(faculty => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name} ({faculty.code})
                  </option>
                ))
              )}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={isLoadingFaculties || isSaving}>
            {isSaving ? <><Spinner animation="border" size="sm" className="me-1" /> Saving...</> : 'Save'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default ClassFormModal;