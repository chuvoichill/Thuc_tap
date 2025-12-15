import React, { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Button, Modal } from 'react-bootstrap'; // Import components
import { useTerm } from '../../layout/DashboardLayout';
import { getAdminClasses } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ClassStudentList from '../../components/drl/ClassStudentList';

const ViewAllClassesPage = () => {
  const { term } = useTerm();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showClassModal, setShowClassModal] = useState(false); // State quản lý Modal

  const fetchData = useCallback(async () => {
    if (!term) return;

    setLoading(true);
    setError(null);
    setSelectedClass(null);
    try {
      const data = await getAdminClasses(term);
      setClasses(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [term]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenClassModal = (fac) => {
    setSelectedClass(fac);
    setShowClassModal(true);
  };

  const handleCloseClassModal = () => {
    setShowClassModal(false);
    setSelectedClass(null);
    // Không cần fetchData() trừ khi FacultyClassList có thay đổi điểm
    // Giữ nguyên logic đóng modal:
    // setFaculties(null); // Dòng này có vẻ sai logic trong code gốc (setFaculties(null) trong handleModalClose)
  };

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <Alert variant="danger">Lỗi tải danh sách lớp: {error}</Alert>;
    if (classes.length === 0) {
      return <Alert variant="info">Không tìm thấy lớp nào.</Alert>;
    }

    return (
      <Table striped responsive className="align-middle">
        <thead>
          <tr>
            <th>Khoa</th>
            <th>Lớp</th>
            <th className="text-end">Sĩ số</th>
            <th className="text-end">ĐRL TB</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {classes.map(c => (
            <tr key={c.class_name}>
              <td>{c.faculty_code}</td>
              <td>{c.class_name}</td>
              <td className="text-end">{c.total_students ?? 0}</td>
              <td className="text-end">{c.avg_score ?? 0}</td>
              <td className="text-end">
                <Button
                  size="sm"
                  variant='success'
                  className="btn-main"
                  onClick={() => handleOpenClassModal(c.class_name)}
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
        <b>TỔNG HỢP THEO LỚP</b>
      </div>

      {renderContent()}
      
      <Modal
        show={showClassModal}
        onHide={handleCloseClassModal}
        keyboard={false}
        size="lg" // Thay thế modal-lg
        scrollable // Thay thế modal-dialog-scrollable
      >
        <Modal.Header closeButton>
          {/* Dùng title động dựa trên selectedFaculty */}
          <Modal.Title id="staticBackdropLabel">
            {selectedClass ? `Danh sách sinh viên lớp ${selectedClass}` : 'Danh sách lớp'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedClass && (
            <div className="mt-3">
              <ClassStudentList
                classCode={selectedClass}
                term={term}
              />
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default ViewAllClassesPage;