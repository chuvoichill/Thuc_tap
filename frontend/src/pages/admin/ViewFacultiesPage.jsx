import React, { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Button, Modal } from 'react-bootstrap'; // Import components
import { useTerm } from '../../layout/DashboardLayout';
import { getAdminFaculties } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import FacultyClassList from '../../components/drl/FacultyClassList';

const ViewFacultiesPage = () => {
  const { term } = useTerm();
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFaculty, setSelectedFaculty] = useState(null); // { code, name }
  const [showClassModal, setShowClassModal] = useState(false); // State quản lý Modal

  const fetchData = useCallback(async () => {
    if (!term) return;

    setLoading(true);
    setError(null);
    setSelectedFaculty(null);
    try {
      const data = await getAdminFaculties(term);
      setFaculties(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [term]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenClassModal = (fac) => {
    setSelectedFaculty(fac);
    setShowClassModal(true);
  };

  const handleCloseClassModal = () => {
    setShowClassModal(false);
    setSelectedFaculty(null);
    // Không cần fetchData() trừ khi FacultyClassList có thay đổi điểm
    // Giữ nguyên logic đóng modal:
    // setFaculties(null); // Dòng này có vẻ sai logic trong code gốc (setFaculties(null) trong handleModalClose)
  };


  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <Alert variant="danger">Lỗi tải danh sách khoa: {error}</Alert>;
    if (faculties.length === 0) {
      return <Alert variant="info">Không tìm thấy khoa nào.</Alert>;
    }

    return (
      <Table striped responsive className="align-middle">
          <thead>
            <tr>
              <th>Mã khoa</th>
              <th>Tên khoa</th>
              <th className="text-end">Số SV</th>
              <th className="text-end">ĐRL TB</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {faculties.map(f => (
              <tr key={f.faculty_code}>
                <td>{f.faculty_code}</td>
                <td>{f.faculty_name}</td>
                <td className="text-end">{f.total_students ?? 0}</td>
                <td className="text-end">{f.avg_score ?? 0}</td>
                <td className="text-end">
                  <Button
                    size="sm"
                    variant='success'
                    className="btn-main"
                    onClick={() => handleOpenClassModal({ code: f.faculty_code, name: f.faculty_name })}
                  >
                    Xem lớp
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
        <i className='bi bi-building me-2'></i>
        Tổng hợp theo khoa – Kỳ <b>{term}</b>
      </div>

      {renderContent()}

      {/* Modal hiển thị danh sách lớp của khoa */}
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
             {selectedFaculty ? `Danh sách lớp – Khoa ${selectedFaculty.name} (${selectedFaculty.code})` : 'Danh sách lớp'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedFaculty && (
            // Component hiển thị danh sách lớp nằm trong Modal.Body
            <FacultyClassList
              facultyCode={selectedFaculty.code}
              facultyName={selectedFaculty.name}
              term={term}
              // Giữ lại onClose trong trường hợp ClassList có Modal con
              onClose={() => { /* Dòng này không cần thiết nếu FacultyClassList không tự đóng Modal cha */ }} 
            />
          )}
        </Modal.Body>
      </Modal>

    </>
  );
};

export default ViewFacultiesPage;