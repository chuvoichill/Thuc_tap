import React from 'react';
import { NavLink } from 'react-router-dom';
import { MENUS } from '../../utils/constants';
import useAuth from '../../hooks/useAuth';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const menuItems = MENUS[user?.role] || [];

  return (
    <div className="card">
      <div className="card-header"><i className="bi bi-gear me-2"></i>TÍNH NĂNG</div>
      <div className="list-group list-group-flush">
        {menuItems.map(m => (
          <NavLink
            key={m.key}
            to={m.path}
            // 'NavLink' tự thêm class 'active', nhưng ta muốn 'menu-active'
            className={({ isActive }) =>
              "list-group-item list-group-item-action" + (isActive ? " menu-active" : "")
            }
          >
            <i className={`bi ${m.icon} me-2`}></i>{m.text}
          </NavLink>
        ))}
        
        {/* Nút Đăng xuất */}
        <a 
          href="#logout" 
          onClick={(e) => {
            e.preventDefault();
            logout();
          }} 
          className="list-group-item list-group-item-action text-danger"
        >
          <i className="bi bi-box-arrow-right me-2"></i>Đăng xuất
        </a>
      </div>
    </div>
  );
};

export default Sidebar;