import React, { useState, useEffect, useCallback } from 'react';
import { Container, Table, Button, Badge, Alert } from 'react-bootstrap';
import { getClassLeaderStudents, checkClassLeaderRole, postClassLeaderAccept, getClassLeaderLockStatus } from '../../services/drlService';
import { useTerm } from '../../layout/DashboardLayout';
import useNotify from '../../hooks/useNotify';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StudentAssessmentModal from '../../components/drl/StudentAssessmentModal';

const ClassLeaderPage = () => {
  const { term } = useTerm();
  // const { user } = useAuth(); // Not used
  const { notify } = useNotify();

  const [isClassLeader, setIsClassLeader] = useState(false);
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    checkLeaderRole();
  }, []);

  const loadLockStatus = useCallback(async () => {
    try {
      const data = await getClassLeaderLockStatus(term);
      setIsLocked(data.isLocked);
    } catch (error) {
      console.error('Lỗi khi tải trạng thái khóa:', error);
    }
  }, [term]);

  const loadStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClassLeaderStudents(term);
      setStudents(data);
    } catch (error) {
      setError('Lỗi khi tải danh sách sinh viên: ' + error.message);
      notify('Lỗi khi tải danh sách sinh viên', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isClassLeader && term) {
      loadStudents();
      loadLockStatus();
    }
  }, [isClassLeader, term, loadLockStatus]);

  const checkLeaderRole = async () => {
    try {
      const data = await checkClassLeaderRole();
      setIsClassLeader(data.is_class_leader);
      setClassInfo({
        class_code: data.class_code,
        class_name: data.class_name
      });

      if (!data.is_class_leader) {
        setError('Bạn không phải lớp trưởng');
      }
    } catch (error) {
      setError('Lỗi khi kiểm tra quyền: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (window.confirm('Bạn có chắc chắn muốn duyệt điểm cho toàn bộ lớp? Sau khi duyệt, bạn sẽ không thể chỉnh sửa thêm.')) {
      try {
        await postClassLeaderAccept(term);
        notify('Đã duyệt điểm thành công!', 'success');
        setIsLocked(true);
        loadStudents(); // Reload để cập nhật trạng thái
      } catch (error) {
        notify('Lỗi khi duyệt điểm: ' + error.message, 'danger');
      }
    }
  };

  const handleModalClose = (didSave) => {
    setSelectedStudent(null);
    if (didSave) {
      loadStudents(); // Reload danh sách sinh viên
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!isClassLeader) {
    return (
      <Container>
        <Alert variant="warning">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Bạn không có quyền truy cập trang này. Chỉ lớp trưởng mới có thể xem và sửa điểm của sinh viên trong lớp.
        </Alert>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container fluid>
      <div className="section-title mb-3">
        <strong>QUẢN LÝ LỚP - {classInfo?.class_name}</strong>
      </div>

      <Alert variant={isLocked ? "success" : "info"} className="mb-3">
        <i className={`bi ${isLocked ? 'bi-lock' : 'bi-info-circle'} me-2`}></i>
        {isLocked 
          ? 'Điểm lớp đã được duyệt. Bạn không thể chỉnh sửa thêm.'
          : 'Với vai trò lớp trưởng, bạn có thể xem và sửa điểm của các sinh viên trong lớp, sau đó duyệt điểm để khóa.'
        }
      </Alert>

      {students.length === 0 ? (
        <Alert variant="warning">Không có sinh viên nào trong lớp.</Alert>
      ) : (
        <Table striped responsive>
          <thead>
            <tr>
              <th>Mã SV</th>
              <th>Họ và tên</th>
              <th className='text-center'>Tổng điểm (SV)</th>
              <th className='text-center'>Tổng điểm (Lớp trưởng)</th>
              <th className='text-center'></th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.student_code}>
                <td>
                  {student.student_code}
                  {student.is_class_leader && (
                    <Badge className="ms-2 section-title" style={{ fontSize: '0.7rem' }}>
                      Lớp trưởng
                    </Badge>
                  )}
                </td>
                <td>{student.name}</td>
                <td className="text-center">
                  <strong>{student.old_score || 0}</strong>
                </td>
                <td className="text-center">
                  <strong>{student.total_score || 0}</strong>
                </td>
                <td className="text-center">
                  <Button
                    className="btn-main"
                    size="sm"
                    variant="success"
                    onClick={() => setSelectedStudent({
                      studentCode: student.student_code,
                      studentName: student.name,
                      note: student.note
                    })}
                  >
                    Xem/Sửa
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <div className="d-flex justify-content-end">
        <Button
          className="btn-main"
          variant={isLocked ? "secondary" : "success"}
          size="sm"
          onClick={handleAccept}
          disabled={isLocked}
        >
          {isLocked ? 'Đã duyệt' : 'Duyệt điểm lớp'}
        </Button>
      </div>

      {selectedStudent && (
        <StudentAssessmentModal
          studentCode={selectedStudent.studentCode}
          studentName={selectedStudent.studentName}
          noted={selectedStudent.note}
          term={term}
          onClose={handleModalClose}
          page="class_leader"
          role={"leader"}
          readOnly={isLocked}
        />
      )}
    </Container>
  );
};

export default ClassLeaderPage;
