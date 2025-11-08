import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Alert, Button } from 'react-bootstrap'; // Import components
import { getAdminClassStudents, getFacultyClassStudents, getTeacherStudents } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import StudentAssessmentModal from './StudentAssessmentModal';
import useAuth from '../../hooks/useAuth';


const ClassStudentList = ({ classCode, term, onListLoaded }) => {
  const {user} = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      let res;
      if (user?.role === 'faculty') {
        if(!classCode || !term || !user.username) return console.log("thiếu dữ liệu!");
        else res = await getFacultyClassStudents(user.username, classCode, term);
      } 

      else if(user?.role === 'admin') {
        if(!classCode || !term) return console.log("thiếu dữ liệu!");
        else res = await getAdminClassStudents(classCode, term);
      }

      else if(user?.role === 'teacher')
      {
          if(!term ) return console.log("thiếu dữ liệu!");
          else res = await getTeacherStudents(user.username, term);
      }
      
      const data = res.data || res; 
      
      setStudents(data);
      if (onListLoaded) onListLoaded();
    } catch (e) {
      console.error('lỗi ko load được sinh viên:', e);
      setError(e.message);
    }
    setLoading(false);
  }, [classCode, term, user?.role, user?.username, onListLoaded]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleModalClose = (didSave) => {
    setSelectedStudent(null);
    if (didSave) {
      fetchData(); // Tải lại danh sách SV để cập nhật điểm
    }
  };

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
              <th>MSV</th>
              <th>Họ tên</th>
              <th className="text-end">Tổng điểm</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.student_code}>
                <td>{s.student_code}</td>
                <td>{s.full_name}</td>
                <td className="text-end">{s.total_score ?? 0}</td>
                <td className="text-end">
                  {/* Dùng Button variant="outline-primary" size="sm" */}
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setSelectedStudent({ code: s.student_code, name: s.full_name })}
                  >
                    Xem/Sửa
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
      {/* Dùng Card */}
      <Card>
        <Card.Header>
          <b>Lớp {classCode}</b> — Danh sách sinh viên
        </Card.Header>
        <Card.Body>
          {renderContent()}
        </Card.Body>
      </Card>

      {selectedStudent && (
        <StudentAssessmentModal
          studentCode={selectedStudent.code}
          studentName={selectedStudent.name}
          term={term}
          onClose={handleModalClose}
        />
      )}
    </>
  );
};

export default ClassStudentList;