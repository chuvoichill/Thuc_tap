import React, { useState, useEffect, useRef } from 'react';

const TermFormModal = ({ termToEdit, onSave, onClose }) => {
  // State lưu dữ liệu form
  const [formData, setFormData] = useState({
    code: '', title: '', year: new Date().getFullYear(), semester: 1,
    start_date: '', end_date: '', is_active: true, is_assessment_open: true
  });
  const [isSaving, setIsSaving] = useState(false); // Trạng thái đang lưu
  const modalRef = useRef(null); // Ref cho DOM element của modal
  const modalInstanceRef = useRef(null); // Ref cho instance modal của Bootstrap
  const onCloseRef = useRef(onClose); // Ref để lưu hàm onClose mới nhất

  // Cập nhật ref onClose khi prop thay đổi
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Điền dữ liệu vào form nếu đang sửa (termToEdit có giá trị)
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
      // Reset form về giá trị mặc định khi tạo mới
      const currentYear = new Date().getFullYear();
      setFormData({
        code: '', title: '', year: currentYear, semester: 1,
        start_date: '', end_date: '', is_active: true, is_assessment_open: true
      });
    }
  }, [termToEdit]); // Chạy lại khi termToEdit thay đổi

  // --- SỬA LOGIC KHỞI TẠO VÀ DỌN DẸP MODAL ---
  useEffect(() => {
    if (!modalRef.current) return;
    const modalEl = modalRef.current;
    // Tạo instance modal Bootstrap MỘT LẦN
    const instance = new window.bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    modalInstanceRef.current = instance;
    instance.show(); // Hiển thị modal

    // Listener QUAN TRỌNG: Chạy KHI modal đã ẩn hoàn toàn
    const handleHidden = () => {
      console.log("Modal hidden event triggered."); // Log để debug

      // 1. DỌN DẸP THỦ CÔNG BACKDROP
      //    Tìm và xóa phần tử nền mờ còn sót lại
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        console.log("Found backdrop, removing..."); // Log
        backdrop.remove();
      } else {
        console.log("No backdrop found to remove."); // Log
      }

      // 2. Gọi dispose() để Bootstrap tự dọn dẹp state nội bộ và listener
      //    Bọc trong try...catch để tránh lỗi nếu instance đã bị hủy
      try {
        if (instance) {
          console.log("Disposing Bootstrap modal instance..."); // Log
          instance.dispose();
        }
      } catch (e) {
         console.warn("Bootstrap dispose error on modal hidden (ignored):", e);
      }

      // 3. Gọi hàm onClose (từ props) để báo cho component cha (ManageTermsPage)
      //    để nó cập nhật state (setShowModal(false)) và React gỡ bỏ component modal
      if (onCloseRef.current) {
        console.log("Calling onClose callback..."); // Log
        onCloseRef.current();
      }
    };
    modalEl.addEventListener('hidden.bs.modal', handleHidden); // Gắn listener

    // Hàm dọn dẹp khi component unmount (ít khi cần đến nếu handleHidden chạy đúng)
    return () => {
      console.log("Modal component unmounting. Cleaning up listener."); // Log
      modalEl.removeEventListener('hidden.bs.modal', handleHidden); // Gỡ bỏ listener

      // Vẫn nên cố gắng dispose nếu instance còn tồn tại khi unmount đột ngột
      try {
          const currentInstance = modalInstanceRef.current;
          if (currentInstance) {
              // Chỉ dispose nếu modal đang hiển thị (tránh gọi dispose 2 lần)
              if (modalEl.classList.contains('show')) {
                 console.log("Disposing instance on unmount as it was still shown."); // Log
                 currentInstance.dispose();
              }
              // Xóa luôn backdrop nếu còn sót khi unmount (phòng hờ)
              const backdrop = document.querySelector('.modal-backdrop');
              if (backdrop) {
                  console.warn("Removing backdrop found during unmount."); // Log
                  backdrop.remove();
              }
          }
      } catch(e) {
           console.warn("Bootstrap dispose/backdrop error on unmount (ignored):", e);
      }
      modalInstanceRef.current = null; // Dọn dẹp ref
    };
  }, []); // Mảng dependency RỖNG, chỉ chạy 1 lần duy nhất khi component mount
  // --- HẾT SỬA ---

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

      await onSave(dataToSend, termToEdit?.code); // Gọi hàm onSave từ props
      // Chỉ gọi hide(), listener 'hidden.bs.modal' sẽ xử lý phần còn lại
      if (modalInstanceRef.current) {
        console.log("Save successful, hiding modal..."); // Log
        modalInstanceRef.current.hide();
      }
    } catch (error) {
      console.error("Save term failed:", error); // Log lỗi
      // Lỗi đã được thông báo ở component cha
      setIsSaving(false); // Quan trọng: Reset saving state nếu lỗi
    }
    // Không reset isSaving ở đây nếu thành công, vì modal sẽ unmount
  };

  // Render JSX
  return (
    <div className="modal fade" ref={modalRef} tabIndex="-1">
      <div className="modal-dialog">
        <div className="modal-content">
          <form onSubmit={handleSave}>
            <div className="modal-header">
              <h5 className="modal-title">{termToEdit ? 'Sửa Học kỳ' : 'Thêm Học kỳ'}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" disabled={isSaving}></button>
            </div>
            <div className="modal-body">
              {/* Mã học kỳ */}
              <div className="mb-3">
                <label htmlFor="code" className="form-label">Mã Học kỳ * <small>(vd: 2025HK1)</small></label>
                <input type="text" className="form-control" id="code" name="code" value={formData.code} onChange={handleChange} required disabled={!!termToEdit || isSaving} maxLength={10} />
              </div>
              {/* Tên học kỳ */}
              <div className="mb-3">
                <label htmlFor="title" className="form-label">Tên Học kỳ * <small>(vd: Học kỳ 1 Năm học 2025-2026)</small></label>
                <input type="text" className="form-control" id="title" name="title" value={formData.title} onChange={handleChange} required disabled={isSaving} />
              </div>
              {/* Năm học và Học kỳ */}
              <div className="row g-2 mb-3">
                <div className="col-md-6">
                    <label htmlFor="year" className="form-label">Năm bắt đầu *</label>
                    <input type="number" className="form-control" id="year" name="year" value={formData.year} onChange={handleChange} required disabled={isSaving} min="2000" max="2100"/>
                </div>
                 <div className="col-md-6">
                    <label htmlFor="semester" className="form-label">Học kỳ *</label>
                    <select className="form-select" id="semester" name="semester" value={formData.semester} onChange={handleChange} required disabled={isSaving}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>Hè (3)</option>
                    </select>
                </div>
              </div>
               {/* Ngày bắt đầu và kết thúc */}
               <div className="row g-2 mb-3">
                 <div className="col-md-6">
                    <label htmlFor="start_date" className="form-label">Ngày bắt đầu</label>
                    <input type="date" className="form-control" id="start_date" name="start_date" value={formData.start_date} onChange={handleChange} disabled={isSaving} />
                 </div>
                  <div className="col-md-6">
                    <label htmlFor="end_date" className="form-label">Ngày kết thúc</label>
                    <input type="date" className="form-control" id="end_date" name="end_date" value={formData.end_date} onChange={handleChange} disabled={isSaving} />
                 </div>
               </div>
              {/* Checkbox trạng thái */}
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="is_active" name="is_active" checked={formData.is_active} onChange={handleChange} disabled={isSaving}/>
                <label className="form-check-label" htmlFor="is_active">
                  Học kỳ đang hoạt động
                </label>
              </div>
               <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" id="is_assessment_open" name="is_assessment_open" checked={formData.is_assessment_open} onChange={handleChange} disabled={isSaving}/>
                <label className="form-check-label" htmlFor="is_assessment_open">
                  Cho phép sinh viên đánh giá
                </label>
              </div>
            </div>
            {/* Nút bấm footer */}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" disabled={isSaving}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TermFormModal;