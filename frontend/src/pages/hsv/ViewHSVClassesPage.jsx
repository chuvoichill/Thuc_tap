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

    return (
      // Dùng Table responsive
      <Table striped responsive className="align-middle">
        <thead>
          <tr>           
            <th>Mã lớp</th>
            <th className="text-end">Sĩ số</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {classes.map(c => (
            <tr key={c.class_code}>
              
              <td>{c.class_code}</td>
              
              <td className="text-end">{c.total_students ?? 0}</td>
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
      <div className='section-title mb-3 px-3'>
        <strong>Danh sách sinh viên khoa {user.faculty_code}</strong>
      </div>

      {renderContent()}

      <Modal show={show} size="xl" onHide={handleClose} scrollable>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-people-fill me-2 text-success"></i>
            Danh sách sinh viên lớp <strong>{selectedClass}</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <HSVStudentList
            classCode={selectedClass}
            term={term}
            showHeader={false}
          />
        </Modal.Body>
      </Modal>
    </>
  );
};

export default ViewHSVClassesPage;