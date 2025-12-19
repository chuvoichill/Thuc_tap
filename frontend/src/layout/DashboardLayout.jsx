import { useState, useEffect } from 'react';
import { Outlet, useOutletContext, NavLink } from 'react-router-dom';
import { Card, Form, Offcanvas, ListGroup } from 'react-bootstrap'; // Import components
import useAuth from '../hooks/useAuth';
import { roleVN } from '../utils/helpers';
import { getTerms } from '../services/drlService';
import { MENUS } from '../utils/constants';

const DashboardLayout = () => {
  const { user, logout, isMonitor } = useAuth();

  // Nếu là sinh viên và là lớp trưởng, thêm menu lớp trưởng
  let menuItems = MENUS[user?.role] || [];
  if (user?.role === 'student' && isMonitor) {
    menuItems = [
      ...menuItems,
      {
        key: 'class-leader',
        path: '/class-leader',
        text: 'Quản lý lớp',
        icon: 'bi-star-fill'
      }
    ];
  }
  
  const [show, setShow] = useState(true);
  const toggleShow = () => setShow((s) => !s);

  const [availableTerms, setAvailableTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [loadingTerms, setLoadingTerms] = useState(true);

  const fetchTerms = async () => {
    setLoadingTerms(true);
    try {
      const termsData = await getTerms();

      setAvailableTerms(termsData || []);

      if (termsData && termsData.length > 0) {
        const defaultTerm =
          termsData.find(t => t.is_active) ||
          termsData[0];
        setSelectedTerm(defaultTerm.code);
      } else {
        setSelectedTerm('');
      }
    } catch (error) {
      console.error("Failed to fetch terms:", error);
      setAvailableTerms([]);
      setSelectedTerm('');
    }
    setLoadingTerms(false);
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  return (
    <>
      <header className="header d-flex justify-content-between align-items-center px-3 py-3 shadow-sm fixed-top">
        <div className='d-flex'>
          <i className="fa-solid fa-bars" onClick={toggleShow}></i>
          <h4 className="mb-0 mx-3 say_hello">
            Xin chào, <span>{user.display_name}</span> ({roleVN(user.role)})
          </h4>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span style={{textWrap:'nowrap'}} >Kỳ học:</span>
          {/* Dùng Form.Select thay cho select.form-select */}
          <Form.Select
            size="sm"
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            style={{ minWidth: '120px',boxShadow: 'none', cursor: 'pointer' }}
            disabled={loadingTerms || availableTerms.length === 0}

          >
            {loadingTerms ? (
              <option>Đang tải...</option>
            ) : availableTerms.length === 0 ? (
              <option>Không có kỳ</option>
            ) : (
              availableTerms.map(t => (
                <option key={t.code} value={t.code}>
                  {t.code}
                  {t.is_active ? '(Đang ĐG)' : ' (Đã đóng)'}
                </option>
              ))
            )}
          </Form.Select>
        </div>

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

      <div className={`${show ? 'showMenu' : 'hideMenu'}`} style={{ marginTop: '62.6px'}}> 
            <Card body style={{ borderRadius: '0',width: '100%'}} className='ctn_body'>
              {selectedTerm ? (
                <Outlet context={{ term: selectedTerm, refreshTerms: fetchTerms }} />
              ) : (
                !loadingTerms && <div className="text-muted text-center p-3">Vui lòng chọn hoặc tạo học kỳ.</div>
              )}
            </Card>
      </div>
    </>
  );
};

// Hook useTerm giữ nguyên
export const useTerm = () => {
  return useOutletContext();
};

export default DashboardLayout;