import React, { useEffect, useRef } from 'react';
import { Toast as BsToast, ToastContainer, Button } from 'react-bootstrap'; // Import components

const Toast = ({ toastInfo, onClose }) => {
  // Thay vì dùng useRef để truy cập DOM, ta chỉ cần dùng state và props của React-Bootstrap

  if (!toastInfo) {
    return null;
  }

  const { message, type } = toastInfo;

  // Ánh xạ type sang variant của React-Bootstrap
  const variant = {
    success: 'success',
    danger: 'danger',
    warning: 'warning',
    info: 'info',
  }[type] || 'success';
  
  // React-Bootstrap ToastContainer giúp định vị
  return (
    <ToastContainer 
      position="bottom-end" 
      className="p-3" 
      style={{ zIndex: 1080, position: 'fixed', bottom: '20px', right: '20px' }}
    >
      <BsToast 
        show={!!toastInfo} // Hiển thị nếu có toastInfo
        onClose={onClose} // Sự kiện đóng (sau animation)
        delay={2000} // Thiết lập delay
        autohide // Tự động ẩn
        bg={variant} // Thiết lập màu nền (background)
        className="align-items-center border-0"
      >
        <div className="d-flex">
          <BsToast.Body className={variant === 'warning' ? 'text-dark' : 'text-white'}>
            {message}
          </BsToast.Body>
          {/* Nút đóng dùng Button của React-Bootstrap */}
          <Button 
            variant="" // Xóa variant để dùng style mặc định (btn-close)
            onClick={onClose}
            className={`btn-close me-2 m-auto ${variant === 'warning' ? 'btn-close-dark' : 'btn-close-white'}`}
            aria-label="Close"
          />
        </div>
      </BsToast>
    </ToastContainer>
  );
};

export default Toast;