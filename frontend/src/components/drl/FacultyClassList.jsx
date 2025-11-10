// frontend/src/components/drl/FacultyClassList.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Alert, Button, Modal } from 'react-bootstrap'; // Import components
import { useTerm } from '../../layout/DashboardLayout';
import useAuth from '../../hooks/useAuth';
import { getAdminClasses, getFacultyClasses } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import ClassStudentList from './ClassStudentList';
import HSVStudentList from './HSVStudentList';

const FacultyClassList = ({ title, facultyCode, facultyName }) => {
  const { term } = useTerm();
  const { user } = useAuth();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);

  const [showClassModal, setShowClassModal] = useState(false); // State quản lý Modal

  const fetchData = useCallback(async () => {
    if (!term || !user?.role) return;

    setLoading(true);
    setError(null);
    setSelectedClass(null);

    try {
      let res;
      if (user.role === 'faculty') {
        res = await getFacultyClasses(user.username, term);
      } else if (user.role === 'admin') {
        if (!facultyCode) throw new Error('Thiếu facultyCode cho admin');
        res = await getAdminClasses(term, facultyCode);
      } else {
        setClasses([]);
        return;
      }

      const data = res?.data ?? res ?? [];
      setClasses(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Fetch error');
    } finally {
      setLoading(false);
    }
  }, [term, user?.role, user?.username, facultyCode]);

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

  const computedTitle =
    title ??
    (user?.role === 'faculty'
      ? `Tổng hợp theo lớp – Khoa ${user?.faculty_code || ''} – Kỳ ${term}`
      : user?.role === 'admin'
        ? `Khoa ${facultyName || facultyCode || ''} — Danh sách lớp`
        : 'Danh sách lớp');

  return (
    <>
      {/* Dùng Card thay cho div.card */}
      <Card>
        {/* Dùng Card.Header thay cho div.card-header */}
        <Card.Header>
          <b>Khoa {facultyName || facultyCode}</b> — Danh sách lớp
        </Card.Header>
        {/* Dùng Card.Body thay cho div.card-body */}
        <Card.Body>
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            // Dùng Alert variant="danger"
            <Alert variant="danger">Lỗi: {error}</Alert>
          ) : !classes.length ? (
            // Dùng Alert variant="info"
            <Alert variant="info">Không có lớp.</Alert>
          ) : (
            // Dùng Table responsive thay cho div.table-responsive
            <Table striped responsive className="align-middle">
              <thead>
                <tr>
                  <th>Mã lớp</th>
                  <th>Tên lớp</th>
                  <th className="text-end">Sĩ số</th>
                  <th className="text-end">Đã tự đánh giá</th>
                  <th className="text-end">ĐRL TB</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.class_code}>
                    <td>{c.class_code}</td>
                    <td>{c.class_name}</td>
                    <td className="text-end">{c.total_students ?? 0}</td>
                    <td className="text-end">{c.completed ?? 0}</td>
                    <td className="text-end">
                      {c.avg_score == null ? '—' : Number(c.avg_score).toFixed(2)}
                    </td>
                    <td className="text-end">
                      {/* Dùng Button variant="outline-primary" size="sm" */}
                      <Button
                        size="sm"
                        variant='success'
                        className="btn-main"
                        onClick={() => handleOpenClassModal(c.class_code)}
                      >
                        Xem sinh viên
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Khi chọn một lớp, component ClassStudentList sẽ hiện ra */}


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
            {selectedClass ? `Danh sách sinh viên lớp ${selectedClass}` : 'Danh sách lớp'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedClass && (
            <div className="mt-3">
              {user?.role === 'hsv' ? (
                <HSVStudentList
                  classCode={selectedClass}
                  term={term} />
              ) : (
                <ClassStudentList classCode={selectedClass} term={term} />
              )}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}
export default FacultyClassList;