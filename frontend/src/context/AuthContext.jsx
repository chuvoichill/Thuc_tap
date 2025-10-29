import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Chờ khôi phục session

  // Khôi phục session từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('auth');
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) {
      localStorage.removeItem('auth');
    }
    setLoading(false); // Khôi phục xong
  }, []);

  const login = async (username, password) => {
    try {
      const authData = await api.post('/api/auth/login', { username, password });
      localStorage.setItem('auth', JSON.stringify(authData));
      setUser(authData);
      return authData;
    } catch (error) {
      throw error; // Ném lỗi ra để LoginPage bắt
    }
  };

  const logout = () => {
    localStorage.removeItem('auth');
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
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