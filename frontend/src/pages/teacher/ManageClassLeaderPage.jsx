import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Badge, Alert } from 'react-bootstrap';
import { getAllTeacherStudents, getClassLeader, assignClassLeader, removeClassLeader } from '../../services/drlService';
import { useTerm } from '../../layout/DashboardLayout';
import useAuth from '../../hooks/useAuth';
import useNotify from '../../hooks/useNotify';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const ManageClassLeaderPage = () => {
  const { term } = useTerm();
  const { user } = useAuth();
  const { notify } = useNotify();

  const [students, setStudents] = useState([]);
  const [classCode, setClassCode] = useState(null);
  const [currentLeader, setCurrentLeader] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (term && user?.username) {
      loadData();
    }
  }, [term, user]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Lấy tất cả sinh viên trong lớp
      const studentsData = await getAllTeacherStudents(user.username, term);
      const data = studentsData.data || studentsData;
      setStudents(data);
      
      if (data.length > 0) {
        const code = data[0].class_code;
        setClassCode(code);
        
        // Lấy thông tin lớp trưởng hiện tại
        const leaderData = await getClassLeader(code);
        setCurrentLeader(leaderData.class_leader);
      }
    } catch (error) {
      setError('Lỗi khi tải dữ liệu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignLeader = async (studentCode) => {
    if (!window.confirm(`Bạn có chắc muốn chỉ định sinh viên này làm lớp trưởng?`)) return;

    try {
      await assignClassLeader(studentCode, classCode);
      notify('Đã chỉ định lớp trưởng thành công!', 'success');
      loadData(); // Reload để cập nhật
    } catch (error) {
      notify('Lỗi: ' + (error.response?.data?.error || error.message), 'danger');
    }
  };

  const handleRemoveLeader = async () => {
    if (!window.confirm('Bạn có chắc muốn bỏ chỉ định lớp trưởng?')) return;

    try {
      await removeClassLeader(classCode);
      notify('Đã bỏ chỉ định lớp trưởng', 'info');
      setCurrentLeader(null);
      loadData();
    } catch (error) {
      notify('Lỗi: ' + (error.response?.data?.error || error.message), 'danger');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <Container>
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  if (students.length === 0) {
    return (
      <Container>
        <Alert variant="info">Không có sinh viên nào trong lớp của bạn.</Alert>
      </Container>
    );
  }

  return (
    <Container fluid>
      <div className="section-title mb-3">
        <strong>QUẢN LÝ LỚP TRƯỞNG - Lớp {classCode}</strong>
      </div>

      {currentLeader && (
        <Alert variant="success" className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <i className="bi bi-star-fill me-2"></i>
            <strong>Lớp trưởng hiện tại:</strong> {currentLeader.name} ({currentLeader.student_code})
          </div>
          <Button 
            size="sm" 
            variant="outline-danger" 
            onClick={handleRemoveLeader}
          >
            <i className="bi bi-x-circle me-1"></i>
            Bỏ chỉ định
          </Button>
        </Alert>
      )}

      {!currentLeader && (
        <Alert variant="info" className="mb-4">
          <i className="bi bi-info-circle me-2"></i>
          Lớp này chưa có lớp trưởng. Vui lòng chọn một sinh viên từ danh sách bên dưới.
        </Alert>
      )}

      <Card>
        <Card.Header className="section-title">
          <strong>Danh sách sinh viên</strong>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="alert alert-light border-0 rounded-0 mb-0 small">
            <i className="bi bi-lightbulb me-1"></i>
            <strong>Quyền của lớp trưởng:</strong> Có thể xem và sửa điểm của các sinh viên trong lớp, nhưng không có quyền duyệt điểm.
          </div>
          <Table striped hover responsive className="mb-0">
            <thead>
              <tr >
                <th>Mã SV</th>
                <th>Họ và tên</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.student_code}>
                  <td>{student.student_code}</td>
                  <td>
                    {student.full_name}
                  </td>
                  <td >
                    {currentLeader?.student_code === student.student_code ? (
                      <Badge className='section-title'>Đang là lớp trưởng</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="success"
                        className='btn-main'
                        onClick={() => handleAssignLeader(student.student_code)}
                      >
                        Chỉ định
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ManageClassLeaderPage;
