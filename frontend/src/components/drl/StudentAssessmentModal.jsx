import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCriteria, getSelfAssessment, saveSelfAssessment } from '../../services/drlService';
import useNotify from '../../hooks/useNotify';
import LoadingSpinner from '../common/LoadingSpinner';
import AssessmentForm from './AssessmentForm';

const StudentAssessmentModal = ({ studentCode, studentName, term, onClose }) => {
  const { notify } = useNotify();

  const modalRef = useRef(null);
  const modalInstanceRef = useRef(null);

  // tránh gọi onClose nhiều lần / setState sau unmount
  const closedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const [criteria, setCriteria] = useState([]);
  const [selfData, setSelfData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const didSaveRef = useRef(false);

  // Khởi tạo modal + lắng nghe hidden
  useEffect(() => {
    if (!modalRef.current || !window?.bootstrap) return;

    const modalEl = modalRef.current;
    const instance = new window.bootstrap.Modal(modalEl, {
      keyboard: true,   // cho phép Esc
      backdrop: true,   // để bootstrap tự quản lý backdrop
      focus: true,
    });
    modalInstanceRef.current = instance;
    instance.show();

    const handleHidden = () => {
      // Ngăn gọi lặp
      if (closedRef.current) return;
      closedRef.current = true;

      // Gọi onClose *sau* khi Bootstrap đã thực sự ẩn (đã vào hidden)
      try {
        onCloseRef.current?.(didSaveRef.current);
      } catch (e) {
        console.warn('onClose error (ignored):', e);
      }
    };

    modalEl.addEventListener('hidden.bs.modal', handleHidden);

    // cleanup: bỏ listener + dispose an toàn
    return () => {
      modalEl.removeEventListener('hidden.bs.modal', handleHidden);
      try { modalInstanceRef.current?.dispose?.(); } catch {}
      modalInstanceRef.current = null;
    };
  }, []);

  // Tải dữ liệu
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [critRes, selfRes] = await Promise.all([
        getCriteria(term),
        getSelfAssessment(studentCode, term),
      ]);
      if (!mountedRef.current) return;        // tránh setState sau unmount
      setCriteria(critRes || []);
      setSelfData(selfRes || []);
    } catch (e) {
      if (mountedRef.current) setError(e?.message || 'Lỗi không xác định');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [term, studentCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Lưu
  const handleSubmit = async (items /*, total */) => {
    if (!mountedRef.current) return;
    setSaving(true);
    try {
      await saveSelfAssessment(studentCode, term, items);
      notify('Đã lưu thành công!');
      didSaveRef.current = true;

      // đóng modal -> sẽ kích hoạt handleHidden
      modalInstanceRef.current?.hide?.();
    } catch (e) {
      notify('Lỗi khi lưu: ' + (e?.message || 'Unknown error'), 'danger');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  return (
    <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Đánh giá: {studentName} ({studentCode}) – Kỳ {term}
            </h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div className="modal-body">
            {loading && <LoadingSpinner />}
            {error && <div className="alert alert-danger">{error}</div>}
            {!loading && !error && (
              <AssessmentForm
                criteria={criteria}
                selfData={selfData}
                onSubmit={handleSubmit}
                isSaving={saving}
                readOnly={false}
              />
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
              Đóng
            </button>
            <button
              type="button"
              className="btn btn-main"
              onClick={() => modalRef.current?.querySelector('form')?.requestSubmit()}
              disabled={loading || saving}
            >
              {saving ? 'Đang lưu...' : (<><i className="bi bi-save me-1"></i> Lưu</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAssessmentModal;

// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { getCriteria, getSelfAssessment, saveSelfAssessment } from '../../services/drlService';
// import useNotify from '../../hooks/useNotify';
// import LoadingSpinner from '../common/LoadingSpinner';
// import AssessmentForm from './AssessmentForm';

// const StudentAssessmentModal = ({ studentCode, studentName, term, onClose }) => {
//   const { notify } = useNotify();
//   const modalRef = useRef(null); // Tham chiếu đến DOM
//   const modalInstanceRef = useRef(null); // Tham chiếu đến đối tượng Modal của Bootstrap
  
//   const didSaveRef = useRef(false);

//   // Dùng ref để lưu hàm onClose
//   const onCloseRef = useRef(onClose);
//   useEffect(() => {
//     onCloseRef.current = onClose;
//   }, [onClose]);

//   const [criteria, setCriteria] = useState([]);
//   const [selfData, setSelfData] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [error, setError] = useState(null);

//   // 1. Khởi tạo và hiển thị Modal
//   useEffect(() => {
//     if (!modalRef.current) return;

//     const modalEl = modalRef.current;
//     const instance = new window.bootstrap.Modal(modalEl);
    
//     modalInstanceRef.current = instance;
//     instance.show();

//     // --- SỬA LỖI QUAN TRỌNG Ở HÀM NÀY ---
//     const handleHidden = () => {
//       // 1. DỌN DẸP THỦ CÔNG:
//       //    Đây là giải pháp "mạnh tay" để xóa backdrop bị kẹt.
//       const backdrop = document.querySelector('.modal-backdrop');
//       if (backdrop) {
//         backdrop.remove();
//       }

//       // 2. Gọi dispose() để Bootstrap dọn dẹp (nếu nó còn)
//       //    Chúng ta bọc trong try...catch để nó không bao giờ gây lỗi
//       try {
//         if (instance) {
//           instance.dispose();
//         }
//       } catch (e) {
//         console.warn("Bootstrap dispose error (ignored):", e);
//       }
      
//       // 3. Báo cho React (gọi onClose) để gỡ bỏ component
//       if (onCloseRef.current) {
//         onCloseRef.current(didSaveRef.current);
//       }
//     };
//     // --- HẾT SỬA LỖI ---

//     modalEl.addEventListener('hidden.bs.modal', handleHidden);

//     return () => {
//       modalEl.removeEventListener('hidden.bs.modal', handleHidden);
//       modalInstanceRef.current = null;
//     };
//   }, []); // Mảng dependency RỖNG, chỉ chạy 1 lần duy nhất

//   // 2. Tải dữ liệu cho modal
//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const [critRes, selfRes] = await Promise.all([
//         getCriteria(term),
//         getSelfAssessment(studentCode, term)
//       ]);
//       setCriteria(critRes);
//       setSelfData(selfRes);
//     } catch (e) {
//       setError(e.message);
//     }
//     setLoading(false);
//   }, [term, studentCode]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData]);

//   // 3. Xử lý lưu
//   const handleSubmit = async (items, total) => {
//     setSaving(true);
//     try {
//       await saveSelfAssessment(studentCode, term, items);
      
//       notify('Đã lưu thành công!');
//       setSaving(false);
      
//       didSaveRef.current = true;
      
//       if (modalInstanceRef.current) {
//         modalInstanceRef.current.hide();
//       }
//       // 'hidden.bs.modal' listener sẽ tự động gọi handleHidden
      
//     } catch (e) {
//       notify('Lỗi khi lưu: ' + e.message, 'danger');
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="modal fade" ref={modalRef} tabIndex="-1">
//       <div className="modal-dialog modal-lg modal-dialog-scrollable">
//         <div className="modal-content">
//           <div className="modal-header">
//             <h5 className="modal-title">
//               Đánh giá: {studentName} ({studentCode}) – Kỳ {term}
//             </h5>
//             <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
//           </div>
//           <div className="modal-body">
//             {loading && <LoadingSpinner />}
//             {error && <div className="alert alert-danger">{error}</div>}
//             {!loading && !error && (
//               <AssessmentForm
//                 criteria={criteria}
//                 selfData={selfData}
//                 onSubmit={handleSubmit}
//                 isSaving={saving}
//                 readOnly={false} 
//               />
//             )}
//           </div>
//           <div className="modal-footer">
//             <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
//               Đóng
//             </button>
//             <button 
//               type="button" 
//               className="btn btn-main"
//               onClick={() => {
//                 modalRef.current?.querySelector('form')?.requestSubmit();
//               }}
//               disabled={loading || saving}
//             >
//               {saving ? 'Đang lưu...' : <><i className="bi bi-save me-1"></i> Lưu</>}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default StudentAssessmentModal;