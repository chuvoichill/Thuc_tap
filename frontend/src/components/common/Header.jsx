import { NavLink } from 'react-router-dom';
import { useEffect, useState} from 'react';
import { Card, ListGroup, Container, Navbar, Offcanvas, Button } from 'react-bootstrap'; // Đổi tên Navbar thành BsNavbar để tránh xung đột
import { MENUS } from '../../utils/constants';
import useAuth from '../../hooks/useAuth';

const Header = (props) => {
  const { user, logout } = useAuth();
  const menuItems = MENUS[user?.role] || [];

  const [show, setShow] = useState(false);
  const toggleShow = () => setShow((s) => !s);

  useEffect(() => {
    props.show(show);
  }, [show]);
  return (
    // Dùng BsNavbar thay cho nav.navbar
    <>
      <header className="header d-flex justify-content-between align-items-center px-3 py-3 shadow-sm fixed-top">
        <i class="fa-solid fa-bars" onClick={toggleShow}></i>
      </header>


      <Offcanvas show={show} backdrop={false} scroll={true} className="sidebar-offcanvas" >
        
        <Offcanvas.Body className="p-0">
          <ListGroup variant="flush">
            {menuItems.map(m => (
              <ListGroup.Item
                key={m.key}
                // Dùng NavLink và as={Link} để giữ nguyên routing logic
                as={NavLink}
                to={m.path}
                action // Thêm prop action để có hiệu ứng hover/active
                // Tùy chỉnh class active, thay 'menu-active' nếu cần
                variant='success'
                className="menu"
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
        </Offcanvas.Body>
      </Offcanvas>

    </>
  );
};

export default Header;