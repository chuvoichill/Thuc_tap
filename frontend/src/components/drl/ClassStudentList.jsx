import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Alert, Button, Form } from 'react-bootstrap'; // Import components
import { getAdminClassStudents, getFacultyClassStudents, getTeacherStudents, getTeacherStudentsUnRated, postAllStudentsScoreToZero, postAccept, getTeacherLockStatus } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import StudentAssessmentModal from './StudentAssessmentModal';
import useAuth from '../../hooks/useAuth';


const ClassStudentList = ({ classCode, term, onListLoaded, isRated, select, resetSl, setClassCode, onStudentsLoaded, page }) => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formData, setFormData] = useState({ msv: '', name: '' });
  const [isLocked, setIsLocked] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let res;
      if (user?.role === 'faculty') {
        if (!classCode || !term) return console.log("thiếu dữ liệu!");
        else res = await getFacultyClassStudents(classCode, term);
      }

      else if (user?.role === 'admin') {
        if (!classCode || !term) return console.log("thiếu dữ liệu!");
        else res = await getAdminClassStudents(classCode, term);
      }

      else if (user?.role === 'teacher') {
        if (!term) return console.log("thiếu dữ liệu!");
        else if (isRated) res = await getTeacherStudents(user.username, term);
        else res = await getTeacherStudentsUnRated(user.username, term)
        if (select) {
          await postAllStudentsScoreToZero(user.username, term)
        }
        setClassCode(res[0]?.class_code || null);
      }

      const data = res.data || res;

      setStudents(data);
      if (onListLoaded) onListLoaded();
      if (onStudentsLoaded) onStudentsLoaded(data); // Truyền danh sách sinh viên lên parent
    } catch (e) {
      console.error('lỗi ko load được sinh viên:', e);
      setError(e.message);
    } finally {
      setLoading(false);
      if (select) resetSl()
    }

  }, [classCode, term, user?.role, user?.username, onListLoaded, onStudentsLoaded, isRated, select, resetSl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Kiểm tra trạng thái khóa nếu là giáo viên
    const checkLockStatus = async () => {
      if (user?.role === 'teacher' && term) {
        try {
          const response = await getTeacherLockStatus(term);
          setIsLocked(response?.data?.isLocked || response?.isLocked || false);
        } catch (error) {
          console.error('Lỗi khi kiểm tra trạng thái khóa:', error);
          setIsLocked(false);
        }
      }
    };
    checkLockStatus();
  }, [user?.role, term]);

  const handleApprove = async () => {
    if (isLocked) {
      alert('Bạn đã duyệt rồi, không thể duyệt lại!');
      return;
    }

    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn duyệt điểm cho tất cả sinh viên?\n\n' +
      'Sau khi duyệt, bạn sẽ không thể chỉnh sửa hoặc duyệt lại được nữa.'
    );
    
    if (!confirmed) return;
    
    try {
      await postAccept(term);
      alert('Đã duyệt thành công!');
      setIsLocked(true); // Cập nhật trạng thái khóa
      fetchData(); // Tải lại danh sách
    } catch (error) {
      alert('Lỗi khi duyệt: ' + (error.response?.data?.message || error.message || 'Không xác định'));
    }
  };

  const handleModalClose = (didSave) => {
    setSelectedStudent(null);
    if (didSave) {
      fetchData(); // Tải lại danh sách SV để cập nhật điểm
    }
  };

  const filteredStudents = students.filter((s) => {
    const msvMatch = s.student_code.toLowerCase().includes(formData.msv.toLowerCase());
    const nameMatch = s.full_name.toLowerCase().includes(formData.name.toLowerCase());
    return msvMatch && nameMatch;
  });

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    // Dùng Alert variant="danger"
    if (error) return <Alert variant="danger">Lỗi tải danh sách sinh viên: {error}</Alert>;
    // Dùng Alert variant="info"
    if (students.length === 0) return <Alert variant="info">Không có sinh viên trong lớp này.</Alert>;

    return (
      // Dùng Table responsive
      <Table striped responsive className="align-middle">
        <thead>
          <tr>
            <th style={{ borderBottom: "none" }}>MSV</th>
            <th style={{ borderBottom: "none" }}>Họ tên</th>
            <th className="text-center" style={{ borderBottom: "none" }}>Tổng điểm</th>
            <th className="text-center" style={{ borderBottom: "none" }}>Tổng điểm mới</th>
            <th style={{ borderBottom: "none" }}></th>
            <th style={{ borderBottom: "none" }}></th>
          </tr>
          <tr>
            <th><Form.Control name="msv" value={formData.msv} onChange={(e) => setFormData({ ...formData, msv: e.target.value })} size='sm'></Form.Control></th>
            <th><Form.Control name="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} size='sm'></Form.Control></th>
            <th style={{ alignContent: 'center' }}></th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.map(s => (
            <tr key={s.student_code}>
              <td>{s.student_code}</td>
              <td>{s.full_name}</td>
              <td className="text-center">{s.old_score ?? 0}</td>
              <td className="text-center">{s.total_score || s.old_score || 0}</td>
              <td className="text-end">
                {/* Dùng Button variant="outline-primary" size="sm" */}
                <Button
                  className="btn-main"
                  variant='success'
                  size="sm"
                  onClick={() => setSelectedStudent({ code: s.student_code, note: s.note })}
                >
                  {page === 'teacher' && isLocked ? 'Xem' : 'Xem/Sửa'}
                </Button>
              </td>
              <td className="text-end">
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <>
      <Card>
        <Card.Body>
          {renderContent()}
        </Card.Body>
      </Card>

      {page === 'teacher' && (
        <div className="d-flex justify-content-end">
          <Button
            className="btn-main mt-3"
            variant={isLocked ? 'secondary' : 'success'}
            size="sm"
            onClick={handleApprove}
            disabled={isLocked}
          >
            {isLocked ? 'Đã duyệt' : 'Duyệt'}
          </Button>
        </div>
      )}

      {selectedStudent && (
        <StudentAssessmentModal
          studentCode={selectedStudent.code}
          noted={selectedStudent.note}
          term={term}
          onClose={handleModalClose}
          page={page}
          isLocked={page === 'teacher' && isLocked}
        />
      )}
    </>
  );
};

export default ClassStudentList;