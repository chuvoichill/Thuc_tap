import React, { useState, useEffect, useRef } from 'react';
import useNotify from '../../hooks/useNotify';
import { getRoles, getAllFacultiesSimple } from '../../services/drlService'; // Thêm API lấy khoa

const UserFormModal = ({ userToEdit, onSave, onClose }) => {
  const { notify } = useNotify();
  const [formData, setFormData] = useState({
    username: '', display_name: '', role_code: '', password: '',
    student_code: '', faculty_code: '', is_active: true,
  });
  const [roles, setRoles] = useState([]);
  const [faculties, setFaculties] = useState([]); // State cho danh sách khoa
  const [isLoadingRefs, setIsLoadingRefs] = useState(true); // Gộp loading roles và faculties
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef(null);
  const modalInstanceRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // (Thêm useEffect này để cập nhật ref)
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Load roles và faculties cho dropdown
  useEffect(() => {
    const fetchRefs = async () => {
      setIsLoadingRefs(true);
      try {
        const [rolesData, facultiesData] = await Promise.all([
          getRoles(), // API lấy roles
          getAllFacultiesSimple() // API lấy faculties
        ]);
        setRoles(rolesData || []);
        setFaculties(facultiesData || []);
        // Set role/faculty mặc định khi tạo mới
        if (!userToEdit) {
            setFormData(prev => ({
                ...prev,
                role_code: rolesData?.[0]?.code || '',
                faculty_code: facultiesData?.[0]?.code || '', // Dùng code làm value
            }));
        }

      } catch (error) {
        notify('Không tải được danh sách tham chiếu: ' + error.message, 'danger');
      }
      setIsLoadingRefs(false);
    };
    fetchRefs();
  }, [notify, userToEdit]); // Chỉ chạy khi userToEdit thay đổi (để reset form)

  // Điền form nếu đang sửa
  useEffect(() => {
    if (userToEdit) {
      setFormData({
        username: userToEdit.username || '',
        display_name: userToEdit.display_name || '',
        role_code: userToEdit.role_code || '',
        password: '', // Không hiển thị mật khẩu cũ
        student_code: userToEdit.student_code || '',
        faculty_code: userToEdit.faculty_code || '', // Dùng code
        is_active: userToEdit.is_active !== undefined ? userToEdit.is_active : true,
      });
    }
     // Logic reset form đã chuyển vào useEffect fetchRefs
  }, [userToEdit]);

  // Khởi tạo modal
  useEffect(() => {
    if (!modalRef.current) return;
    const modalEl = modalRef.current;
    const instance = new window.bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    modalInstanceRef.current = instance;
    instance.show();

    const handleHidden = () => {
      // 1. DỌN DẸP THỦ CÔNG BACKDROP
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();

      // 2. GỌI DISPOSE
      try { if (instance) instance.dispose(); } catch (e) {}
      
      // 3. GỌI ONCLOSE QUA REF
      if (onCloseRef.current) onCloseRef.current();
    };
    modalEl.addEventListener('hidden.bs.modal', handleHidden);
    
    return () => {
      modalEl.removeEventListener('hidden.bs.modal', handleHidden);
      try {
          if (modalInstanceRef.current) modalInstanceRef.current.dispose();
          const backdrop = document.querySelector('.modal-backdrop');
          if (backdrop) backdrop.remove();
      } catch(e) {}
      modalInstanceRef.current = null;
    };
  }, []); // Mảng dependency RỖNG

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
    // Xóa student_code nếu role không phải student
    if(dataToSend.role_code !== 'student') dataToSend.student_code = null;
    // Xóa faculty_code nếu role không yêu cầu
    if(!['teacher', 'faculty', 'hsv', 'union'].includes(dataToSend.role_code)) dataToSend.faculty_code = null;


    try {
      await onSave(dataToSend, userToEdit?.id || userToEdit?.username); // Backend có thể dùng id hoặc username làm key
      if (modalInstanceRef.current) modalInstanceRef.current.hide();
    } catch (error) { /* Lỗi xử lý ở cha */ }
    finally { setIsSaving(false); }
  };

  return (
    <div className="modal fade" ref={modalRef} tabIndex="-1">
      <div className="modal-dialog">
        <div className="modal-content">
          <form onSubmit={handleSave}>
            <div className="modal-header">
              <h5 className="modal-title">{userToEdit ? 'Sửa người dùng' : 'Thêm người dùng'}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" disabled={isSaving}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label htmlFor="username" className="form-label">Username *</label>
                <input type="text" className="form-control" id="username" name="username" value={formData.username} onChange={handleChange} required disabled={!!userToEdit || isSaving} />
              </div>
              <div className="mb-3">
                <label htmlFor="display_name" className="form-label">Tên hiển thị *</label>
                <input type="text" className="form-control" id="display_name" name="display_name" value={formData.display_name} onChange={handleChange} required disabled={isSaving} />
              </div>
               <div className="mb-3">
                 <label htmlFor="password" className="form-label">Mật khẩu {userToEdit ? '(Để trống nếu không đổi)' : '*'}</label>
                 <input type="password" className="form-control" id="password" name="password" value={formData.password} onChange={handleChange} required={!userToEdit} disabled={isSaving} />
               </div>
              <div className="mb-3">
                <label htmlFor="role_code" className="form-label">Vai trò *</label>
                <select className="form-select" id="role_code" name="role_code" value={formData.role_code} onChange={handleChange} required disabled={isLoadingRefs || isSaving}>
                  {isLoadingRefs ? <option>Đang tải...</option> : (
                    roles.map(role => <option key={role.code} value={role.code}>{role.name || role.code}</option>) // Hiển thị name nếu có
                  )}
                </select>
              </div>

               {/* Hiện student_code nếu role là student */}
               {formData.role_code === 'student' && (
                 <div className="mb-3">
                   <label htmlFor="student_code" className="form-label">Mã Sinh viên</label>
                   <input type="text" className="form-control" id="student_code" name="student_code" value={formData.student_code || ''} onChange={handleChange} disabled={isSaving} />
                 </div>
               )}

               {/* Hiện faculty_code nếu role là teacher, faculty, hsv, union */}
               {['teacher', 'faculty', 'hsv', 'union'].includes(formData.role_code) && (
                 <div className="mb-3">
                   <label htmlFor="faculty_code" className="form-label">Khoa</label>
                   <select className="form-select" id="faculty_code" name="faculty_code" value={formData.faculty_code || ''} onChange={handleChange} disabled={isLoadingRefs || isSaving}>
                      <option value="">-- Chọn Khoa --</option>
                     {isLoadingRefs ? <option>Đang tải...</option> : (
                       faculties.map(f => <option key={f.code} value={f.code}>{f.name} ({f.code})</option>) // Value là code
                     )}
                   </select>
                 </div>
               )}

              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" id="is_active" name="is_active" checked={formData.is_active} onChange={handleChange} disabled={isSaving}/>
                <label className="form-check-label" htmlFor="is_active">Đang hoạt động</label>
              </div>

            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" disabled={isSaving}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserFormModal;