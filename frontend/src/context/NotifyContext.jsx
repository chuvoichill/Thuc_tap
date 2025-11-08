import React, { createContext, useState, useCallback } from 'react';
// Import Toast (đã được chuyển đổi sang React-Bootstrap)
import Toast from '../components/common/Toast'; 

const NotifyContext = createContext(null);

export const NotifyProvider = ({ children }) => {
  const [toast, setToast] = useState(null); // { message, type, id }

  const notify = useCallback((message, type = 'success') => {
    // Gán ID duy nhất để React re-render Toast
    setToast({ message, type, id: Date.now() });
  }, []);

  return (
    <NotifyContext.Provider value={{ notify }}>
      {children}
      {/* Sử dụng component Toast đã được chuyển đổi.
        Toast này đã được bọc trong ToastContainer của React-Bootstrap 
        và quản lý hiển thị/ẩn dựa trên prop 'toastInfo' và gọi 'onClose'.
      */}
      <Toast
        toastInfo={toast}
        onClose={() => setToast(null)}
      />
    </NotifyContext.Provider>
  );
};

export default NotifyContext;