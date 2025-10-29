import React, { createContext, useState, useCallback } from 'react';
import Toast from '../components/common/Toast';

const NotifyContext = createContext(null);

export const NotifyProvider = ({ children }) => {
  const [toast, setToast] = useState(null); // { message, type }

  const notify = useCallback((message, type = 'success') => {
    // Gán ID duy nhất để React re-render Toast
    setToast({ message, type, id: Date.now() });
  }, []);

  return (
    <NotifyContext.Provider value={{ notify }}>
      {children}
      {/* Component Toast nằm ở đây, lắng nghe state 'toast'
        và tự động hiển thị khi state thay đổi.
      */}
      <Toast
        toastInfo={toast}
        onClose={() => setToast(null)}
      />
    </NotifyContext.Provider>
  );
};

export default NotifyContext;