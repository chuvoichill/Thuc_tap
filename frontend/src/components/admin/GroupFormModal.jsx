import React, { useState, useEffect, useRef } from 'react';

const GroupFormModal = ({ groupToEdit, termCode, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    code: '', title: '', display_order: 99
  });
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef(null);
  const modalInstanceRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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

  useEffect(() => {
    if (!modalRef.current) return;
    const modalEl = modalRef.current;
    // Dùng keyboard: false để tránh lỗi khi backdrop bị kẹt
    const instance = new window.bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    modalInstanceRef.current = instance;
    instance.show();

    // Listener QUAN TRỌNG: Chạy KHI modal đã ẩn hoàn toàn
    const handleHidden = () => {
      // 1. DỌN DẸP THỦ CÔNG BACKDROP (Rất quan trọng)
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }

      // 2. Gọi dispose()
      try {
        if (instance) {
          instance.dispose();
        }
      } catch (e) {
         console.warn("Bootstrap dispose error (ignored):", e);
      }

      // 3. Gọi hàm onClose (từ props) qua ref
      if (onCloseRef.current) {
        onCloseRef.current();
      }
    };
    modalEl.addEventListener('hidden.bs.modal', handleHidden); // Gắn listener

    // Hàm dọn dẹp khi component unmount (phòng hờ)
    return () => {
      modalEl.removeEventListener('hidden.bs.modal', handleHidden);
      try {
          // Thử dispose nếu instance còn
          if (modalInstanceRef.current) {
             modalInstanceRef.current.dispose();
          }
          // Xóa backdrop nếu còn sót khi unmount
          const backdrop = document.querySelector('.modal-backdrop');
          if (backdrop) {
              backdrop.remove();
          }
      } catch(e) {
           console.warn("Bootstrap dispose/backdrop error on unmount (ignored):", e);
      }
      modalInstanceRef.current = null;
    };
  }, []); // Mảng dependency RỖNG, chỉ chạy 1 lần

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Gửi cả term_code (khi tạo mới)
      const dataToSend = { ...formData, term_code: termCode }; 
      await onSave(dataToSend, groupToEdit?.id);
      if (modalInstanceRef.current) modalInstanceRef.current.hide();
    } catch (error) { /* Lỗi đã được xử lý ở cha */ } 
    finally { setIsSaving(false); }
  };

  return (
    <div className="modal fade" ref={modalRef} tabIndex="-1">
      <div className="modal-dialog">
        <div className="modal-content">
          <form onSubmit={handleSave}>
            <div className="modal-header">
              <h5 className="modal-title">{groupToEdit ? 'Sửa Nhóm TC' : 'Thêm Nhóm TC'}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" disabled={isSaving}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Học kỳ (Không đổi được)</label>
                <input type="text" className="form-control" value={termCode} disabled />
              </div>
              <div className="mb-3">
                <label htmlFor="code" className="form-label">Mã Nhóm * (vd: 1, 2, ...)</label>
                <input type="text" className="form-control" id="code" name="code" value={formData.code} onChange={handleChange} required disabled={isSaving} />
              </div>
              <div className="mb-3">
                <label htmlFor="title" className="form-label">Tên Nhóm *</label>
                <input type="text" className="form-control" id="title" name="title" value={formData.title} onChange={handleChange} required disabled={isSaving} />
              </div>
              <div className="mb-3">
                <label htmlFor="display_order" className="form-label">Thứ tự</label>
                <input type="number" className="form-control" id="display_order" name="display_order" value={formData.display_order} onChange={handleChange} disabled={isSaving} />
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
export default GroupFormModal;