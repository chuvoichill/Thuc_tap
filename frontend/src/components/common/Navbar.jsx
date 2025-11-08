import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar as BsNavbar, Container } from 'react-bootstrap'; // Đổi tên Navbar thành BsNavbar để tránh xung đột

const Navbar = () => {
  return (
    // Dùng BsNavbar thay cho nav.navbar
    <BsNavbar>
      {/* Dùng Container thay cho div.container-xxl */}
      <Container fluid="xxl">
        {/* Dùng Navbar.Brand thay cho Link.navbar-brand */}
        <BsNavbar.Brand as={Link} to="/" className="fw-semibold">
          <i className="bi bi-mortarboard me-2"></i>
          Hệ thống Đánh giá Điểm Rèn luyện
        </BsNavbar.Brand>
        {/* Dùng Navbar.Text thay cho span.navbar-text */}
        <BsNavbar.Text className="d-none d-md-inline">
          React Frontend
        </BsNavbar.Text>
      </Container>
    </BsNavbar>
  );
};

export default Navbar;