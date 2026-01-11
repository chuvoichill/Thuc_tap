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
      <Toast
        toastInfo={toast}
        onClose={() => setToast(null)}
      />
    </NotifyContext.Provider>
  );
};

export default NotifyContext;