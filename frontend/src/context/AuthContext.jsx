import { createContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [isMonitor, setIsMonitor] = useState(false); 

  // Khôi phục session từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('auth');
      if (saved) {
        const userData = JSON.parse(saved);
        setUser(userData);
        
        // Kiểm tra xem user có phải lớp trưởng không
        if (userData.role === 'student') {
          checkMonitorStatus(userData.token);
        }
      }
    } catch (e) {
      localStorage.removeItem('auth');
    }
    setLoading(false); // Khôi phục xong
  }, []);

  const checkMonitorStatus = async (token) => {
    try {
      const response = await api.get('/api/class-leader/check', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsMonitor(response.is_class_leader || false);
    } catch (error) {
      console.error('Lỗi kiểm tra lớp trưởng:', error);
      setIsMonitor(false);
    }
  };

  const login = async (username, password) => {
    try {
      const authData = await api.post('/api/auth/login', { username, password });
      localStorage.setItem('auth', JSON.stringify(authData));
      setUser(authData);
      
      // Kiểm tra lớp trưởng nếu là sinh viên
      if (authData.role === 'student') {
        checkMonitorStatus(authData.token);
      }
      
      return authData;
    } catch (error) {
      throw error; // Ném lỗi ra để LoginPage bắt
    }
  };

  const logout = () => {
    localStorage.removeItem('auth');
    setUser(null);
    setIsMonitor(false);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    isMonitor,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;