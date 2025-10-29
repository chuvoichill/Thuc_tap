import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="navbar navbar-expand-lg">
      <div className="container-xxl">
        <Link className="navbar-brand fw-semibold" to="/">
          <i className="bi bi-mortarboard me-2"></i>
          Hệ thống Đánh giá Điểm Rèn luyện
        </Link>
        <span className="navbar-text d-none d-md-inline">
          React Frontend
        </span>
      </div>
    </nav>
  );
};

export default Navbar;