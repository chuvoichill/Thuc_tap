import React from 'react';
import { NavLink } from 'react-router-dom';
import { Card, ListGroup, Button } from 'react-bootstrap'; // Import components
import { MENUS } from '../../utils/constants';
import useAuth from '../../hooks/useAuth';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const menuItems = MENUS[user?.role] || [];

  return (
    <Card>
      {/* Dùng Card.Header thay cho div.card-header */}
      <Card.Header className="fw-semibold"><i className="bi bi-gear me-2"></i>TÍNH NĂNG</Card.Header>
      
      {/* Dùng ListGroup thay cho div.list-group */}
      <ListGroup variant="flush">
        {menuItems.map(m => (
          <ListGroup.Item
            key={m.key}
            // Dùng NavLink và as={Link} để giữ nguyên routing logic
            as={NavLink}
            to={m.path}
            action // Thêm prop action để có hiệu ứng hover/active
            // Tùy chỉnh class active, thay 'menu-active' nếu cần
            className={({ isActive }) => (isActive ? " menu-active" : "")}
          >
            <i className={`bi ${m.icon} me-2`}></i>{m.text}
          </ListGroup.Item>
        ))}
        
        {/* Nút Đăng xuất */}
        <ListGroup.Item
          as="a" // Dùng as="a" hoặc as={Button}
          href="#logout" 
          onClick={(e) => {
            e.preventDefault();
            logout();
          }} 
          action // Thêm action
          className="text-danger" // Giữ màu đỏ
        >
          <i className="bi bi-box-arrow-right me-2"></i>Đăng xuất
        </ListGroup.Item>
      </ListGroup>
    </Card>
  );
};

export default Sidebar;