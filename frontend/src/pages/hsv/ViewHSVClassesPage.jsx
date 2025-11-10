import React, { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Button, Modal } from 'react-bootstrap'; // Import components
import { useTerm } from '../../layout/DashboardLayout';
import useAuth from '../../hooks/useAuth';
import { getHSVClasses } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import HSVStudentList from '../../components/drl/HSVStudentList';

const ViewHSVClassesPage = () => {
  const { term } = useTerm();
  const { user } = useAuth();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);

  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = (class_code) => {
    setSelectedClass(class_code);
    setShow(true)
  };

  const fetchData = useCallback(async () => {
    if (!term || !user?.username) return;

    setLoading(true);
    setError(null);
    setSelectedClass(null);
    try {
      const data = await getHSVClasses(user.username, term);
      setClasses(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [term, user?.username]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    // Dùng Alert variant="danger"
    if (error) return <Alert variant="danger">Lỗi tải danh sách lớp: {error}</Alert>;
    // Dùng Alert variant="info"
    if (classes.length === 0) {
      return <Alert variant="info">Không tìm thấy lớp nào.</Alert>;
    }

    const showFaculty = classes.length > 0 && classes[0].faculty_code;

    return (
      // Dùng Table responsive
      <Table striped responsive className="align-middle">
        <thead>
          <tr>
            {showFaculty && <th>Khoa</th>}
            <th>Mã lớp</th>
            <th>Tên lớp</th>
            <th className="text-end">Sĩ số</th>
            <th className="text-end">Đã tự đánh giá</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {classes.map(c => (
            <tr key={c.class_code}>
              {showFaculty && <td>{c.faculty_code}</td>}
              <td>{c.class_code}</td>
              <td>{c.class_name}</td>
              <td className="text-end">{c.total_students ?? 0}</td>
              <td className="text-end">{c.completed ?? 0}</td>
              <td className="text-end">
                {/* Dùng Button variant="outline-primary" size="sm" */}
                <Button
                  size="sm"
                  className='btn-main'
                  variant="success"
                  onClick={() => handleShow(c.class_code)}
                >
                  Xem sinh viên
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <>
      <div className='section-title mb-3'>
        <i className='bi bi-people me-2'></i>
        HSV – Xác nhận hoạt động ĐTN/HSV (tiêu chí 2.1) – Kỳ <b>{term}</b>
      </div>

      {renderContent()}

      <Modal show={show} size="xl" onHide={handleClose} scrollable>
        <Modal.Header closeButton>
          <Modal.Title></Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <HSVStudentList
            classCode={selectedClass}
            term={term}
          />
        </Modal.Body>
      </Modal>
    </>
  );
};

export default ViewHSVClassesPage;