import React, { useState } from 'react';
import { Card, Form, Alert, Button, Spinner } from 'react-bootstrap'; // Import components
import useAuth from '../hooks/useAuth';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      return setError('Vui lòng nhập đủ tài khoản & mật khẩu');
    }
    
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Sai tài khoản hoặc mật khẩu');
    }
    setLoading(false);
  };

  return (
    // Dùng Card với padding
    <Card className="p-3 login-card">
      <h5 className="text-center mb-3">Đăng nhập</h5>
      
      {/* Dùng Alert variant="danger" */}
      {error && (
        <Alert variant="danger">
          {error}
        </Alert>
      )}

      {/* Dùng Form component */}
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-2">
          <Form.Label>Tài khoản</Form.Label>
          <Form.Control 
            id="username"
            placeholder="vd: 671001/GV001"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Mật khẩu</Form.Label>
          <Form.Control 
            id="password"
            type="password" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </Form.Group>
        {/* Dùng Button component */}
        <Button 
           // Thay btn-main bằng variant primary
          variant='success'
          className="w-100 btn-main" 
          type="submit" 
          disabled={loading}
        >
          {loading ? 
             <><Spinner animation="border" size="sm" className="me-1" /> Đang đăng nhập...</> 
             : 'Đăng nhập'}
        </Button>
      </Form>
    </Card>
  );
};

export default LoginPage;