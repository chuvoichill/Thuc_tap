import React, { useState } from 'react';
import useAuth from '../hooks/useAuth';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth(); // Lấy hàm login từ context

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      return setError('Vui lòng nhập đủ tài khoản & mật khẩu');
    }
    
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      // Không cần navigate, App.jsx sẽ tự động chuyển hướng
    } catch (err) {
      setError(err.message || 'Sai tài khoản hoặc mật khẩu');
    }
    setLoading(false);
  };

  return (
    <div className="card p-3 login-card">
      <h5 className="text-center mb-3">Đăng nhập</h5>
      
      {error && (
        <div id="loginAlert" className="alert alert-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-2">
          <label className="form-label">Tài khoản (MSSV / username)</label>
          <input 
            id="username"
            className="form-control" 
            placeholder="vd: 671001 hoặc gv001"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Mật khẩu</label>
          <input 
            id="password"
            type="password" 
            className="form-control" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <button id="btnLogin" className="btn btn-main w-100" type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;