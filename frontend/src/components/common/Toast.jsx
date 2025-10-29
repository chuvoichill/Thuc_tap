import React, { useEffect, useRef } from 'react';

// Dòng "import { Toast as BsToast } from 'bootstrap';" đã bị xóa

const Toast = ({ toastInfo, onClose }) => {
  const toastRef = useRef(null);

  useEffect(() => {
    if (!toastInfo || !toastRef.current) {
      return;
    }

    // *** SỬA LỖI Ở DÒNG NÀY ***
    // const bsToast = new BsToast(toastRef.current, { delay: 2000 }); // Lỗi 'BsToast' is not defined
    const bsToast = new window.bootstrap.Toast(toastRef.current, { delay: 2000 }); // ĐÃ SỬA

    bsToast.show();

    // Lắng nghe sự kiện hide và gọi onClose
    const handleHidden = () => {
      onClose();
    };
    const currentToastEl = toastRef.current;
    currentToastEl.addEventListener('hidden.bs.toast', handleHidden);

    return () => {
      currentToastEl.removeEventListener('hidden.bs.toast', handleHidden);
    };
  }, [toastInfo, onClose]); // Chạy lại khi 'toastInfo' thay đổi

  if (!toastInfo) {
    return null;
  }

  const { message, type } = toastInfo;

  // Đổi màu theo type
  const bgClass = {
    success: 'text-bg-success',
    danger: 'text-bg-danger',
    warning: 'text-bg-warning',
    info: 'text-bg-info',
  }[type] || 'text-bg-success';

  return (
    <div 
      className={`toast align-items-center border-0 position-fixed bottom-0 end-0 m-3 ${bgClass}`}
      role="alert" 
      aria-live="assertive" 
      aria-atomic="true"
      ref={toastRef}
      style={{ zIndex: 1080 }}
    >
      <div className="d-flex">
        <div className="toast-body">{message}</div>
        <button 
          type="button" 
          className="btn-close btn-close-white me-2 m-auto" 
          data-bs-dismiss="toast" 
          aria-label="Close"
        ></button>
      </div>
    </div>
  );
};

export default Toast;