import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Alert, Button, Form } from 'react-bootstrap'; // Import components
import { getAdminClassStudents, getFacultyClassStudents, getTeacherStudents, getTeacherStudentsUnRated, postAllStudentsScoreToZero } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import StudentAssessmentModal from './StudentAssessmentModal';
import useAuth from '../../hooks/useAuth';


const ClassStudentList = ({ classCode, term, onListLoaded, isRated, select, resetSl, setClassCode }) => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formData, setFormData] = useState({ msv: '', name: '' });
  const [note, setNote] = useState({}); // State để lưu ghi chú cho từng sinh viên

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
    } catch (e) {
      console.error('lỗi ko load được sinh viên:', e);
      setError(e.message);
    } finally {
      setLoading(false);
      if (select) resetSl()
    }

  }, [classCode, term, user?.role, user?.username, onListLoaded, isRated, select, resetSl]);

  useEffect(() => {
    fetchData();

  }, [fetchData]);

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
            <th className="text-center" style={{ borderBottom: "none" }}>Ghi chú</th>
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.map(s => (
            <tr key={s.student_code}>
              <td>{s.student_code}</td>
              <td>{s.full_name}</td>
              <td className="text-center">{s.total_score ?? 0}</td>
              <td className="text-center">{s.total_score ?? 0}</td>
              <td className="text-end"><Form.Control as="textarea" placeholder='Ghi chú..' style={{ height: "1px" }} onChange={(e)=> setNote(e.target.value)}></Form.Control></td>
              <td className="text-end">
                {/* Dùng Button variant="outline-primary" size="sm" */}
                <Button
                  className="btn-main"
                  variant='success'
                  size="sm"
                  onClick={() => setSelectedStudent({ code: s.student_code, name: s.full_name })}
                >
                  Xem/Sửa
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

      <div className="d-flex justify-content-end">
        <Button
          className="btn-main mt-3"
          variant='success'
          size="sm"
        >
          Duyệt
        </Button>
      </div>

      {selectedStudent && (
        <StudentAssessmentModal
          studentCode={selectedStudent.code}
          studentName={selectedStudent.name}
          term={term}
          note={note}
          onClose={handleModalClose}
        />
      )}
    </>
  );
};

export default ClassStudentList;