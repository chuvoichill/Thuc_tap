import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Spinner, Row, Col } from 'react-bootstrap'; // Import components
import useNotify from '../../hooks/useNotify';
import { getRoles, getAllFacultiesSimple } from '../../services/drlService'; 

const UserFormModal = ({ userToEdit, onSave, onClose }) => {
  const { notify } = useNotify();
  const [formData, setFormData] = useState({
    username: '', display_name: '', role_code: '', password: '',
    student_code: '', faculty_code: '', is_active: true,
  });
  const [roles, setRoles] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [isLoadingRefs, setIsLoadingRefs] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [show, setShow] = useState(true); 

  // Load roles và faculties
  useEffect(() => {
    const fetchRefs = async () => {
      setIsLoadingRefs(true);
      try {
        const [rolesData, facultiesData] = await Promise.all([
          getRoles(),
          getAllFacultiesSimple()
        ]);
        setRoles(rolesData || []);
        setFaculties(facultiesData || []);
        if (!userToEdit) {
            setFormData(prev => ({
                ...prev,
                role_code: rolesData?.[0]?.code || '',
                faculty_code: facultiesData?.[0]?.code || '',
            }));
        }
      } catch (error) {
        notify('Không tải được danh sách tham chiếu: ' + error.message, 'danger');
      }
      setIsLoadingRefs(false);
    };
    fetchRefs();
  }, [notify, userToEdit]);

  // Điền form nếu đang sửa
  useEffect(() => {
    if (userToEdit) {
      setFormData({
        username: userToEdit.username || '',
        display_name: userToEdit.display_name || '',
        role_code: userToEdit.role_code || '',
        password: '',
        student_code: userToEdit.student_code || '',
        faculty_code: userToEdit.faculty_code || '',
        is_active: userToEdit.is_active !== undefined ? userToEdit.is_active : true,
      });
    }
  }, [userToEdit]);

  const handleClose = () => setShow(false);
  const handleExited = () => onClose();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const dataToSend = { ...formData };
    if (!userToEdit && !dataToSend.password) {
       notify('Vui lòng nhập mật khẩu cho người dùng mới.', 'warning'); setIsSaving(false); return;
    }
    if (userToEdit && !dataToSend.password) delete dataToSend.password;
    if(dataToSend.role_code !== 'student') dataToSend.student_code = null;
    if(!['teacher', 'faculty', 'hsv', 'union'].includes(dataToSend.role_code)) dataToSend.faculty_code = null;

    try {
      await onSave(dataToSend, userToEdit?.id || userToEdit?.username);
      handleClose();
    } catch (error) { 
        /* Lỗi xử lý ở cha */ 
    }
    finally { setIsSaving(false); }
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
        <Modal.Title>{userToEdit ? 'Sửa người dùng' : 'Thêm người dùng'}</Modal.Title>
      </Modal.Header>
      
      <Form onSubmit={handleSave}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="username">Username *</Form.Label>
            <Form.Control type="text" id="username" name="username" value={formData.username} onChange={handleChange} required disabled={!!userToEdit || isSaving} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="display_name">Tên hiển thị *</Form.Label>
            <Form.Control type="text" id="display_name" name="display_name" value={formData.display_name} onChange={handleChange} required disabled={isSaving} />
          </Form.Group>
           <Form.Group className="mb-3">
             <Form.Label htmlFor="password">Mật khẩu {userToEdit ? '(Để trống nếu không đổi)' : '*'}</Form.Label>
             <Form.Control type="password" id="password" name="password" value={formData.password} onChange={handleChange} required={!userToEdit} disabled={isSaving} />
           </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="role_code">Vai trò *</Form.Label>
            <Form.Select id="role_code" name="role_code" value={formData.role_code} onChange={handleChange} required disabled={isLoadingRefs || isSaving}>
              {isLoadingRefs ? <option>Đang tải...</option> : (
                roles.map(role => <option key={role.code} value={role.code}>{role.name || role.code}</option>)
              )}
            </Form.Select>
          </Form.Group>

           {/* Hiện student_code nếu role là student */}
           {formData.role_code === 'student' && (
             <Form.Group className="mb-3">
               <Form.Label htmlFor="student_code">Mã Sinh viên</Form.Label>
               <Form.Control type="text" id="student_code" name="student_code" value={formData.student_code || ''} onChange={handleChange} disabled={isSaving} />
             </Form.Group>
           )}

           {/* Hiện faculty_code nếu role là teacher, faculty, hsv, union */}
           {['teacher', 'faculty', 'hsv', 'union'].includes(formData.role_code) && (
             <Form.Group className="mb-3">
               <Form.Label htmlFor="faculty_code">Khoa</Form.Label>
               <Form.Select id="faculty_code" name="faculty_code" value={formData.faculty_code || ''} onChange={handleChange} disabled={isLoadingRefs || isSaving}>
                  <option value="">-- Chọn Khoa --</option>
                 {isLoadingRefs ? <option>Đang tải...</option> : (
                   faculties.map(f => <option key={f.code} value={f.code}>{f.name} ({f.code})</option>)
                 )}
               </Form.Select>
             </Form.Group>
           )}

          <Form.Check 
            type="checkbox" 
            id="is_active" 
            name="is_active" 
            label="Đang hoạt động" 
            checked={formData.is_active} 
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

export default UserFormModal;