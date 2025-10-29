import React, { useState, useEffect, useCallback } from 'react';
import { useTerm } from '../../layout/DashboardLayout';
import useAuth from '../../hooks/useAuth';
import { getTeacherStudents } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StudentAssessmentModal from '../../components/drl/StudentAssessmentModal';

const ViewStudentsPage = () => {
  const { term } = useTerm();
  const { user } = useAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State cho Modal
  const [selectedStudent, setSelectedStudent] = useState(null); // { code, name }

  const fetchData = useCallback(async () => {
    if (!term || !user?.username) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getTeacherStudents(user.username, term);
      setStudents(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [term, user?.username]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hàm được gọi khi Modal lưu thành công và đóng lại
  // Chúng ta sẽ tải lại danh sách để cập nhật tổng điểm
  const handleModalClose = (didSave) => {
    setSelectedStudent(null);
    if (didSave) {
      fetchData(); // Tải lại danh sách
    }
  };

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <div className="alert alert-danger">Lỗi: {error}</div>;
    if (students.length === 0) {
      return <div className="alert alert-info">Không tìm thấy sinh viên nào.</div>;
    }

    return (
      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>MSSV</th>
              <th>Họ tên</th>
              <th>Lớp</th>
              <th className="text-end">Tổng điểm</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.student_code}>
                <td>{s.student_code}</td>
                <td>{s.full_name}</td>
                <td>{s.class_code}</td>
                <td className="text-end">{s.total_score}</td>
                <td className="text-end">
                  <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setSelectedStudent({ code: s.student_code, name: s.full_name })}
                  >
                    Xem/Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <div className='section-title mb-3'>
        <i className='bi bi-people me-2'></i>
        Sinh viên các lớp phụ trách – Kỳ <b>{term}</b>
      </div>
      
      {renderContent()}

      {/* Modal sẽ được render ở đây.
        Nó bị ẩn theo mặc định cho đến khi 'selectedStudent' có giá trị.
      */}
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

export default ViewStudentsPage;