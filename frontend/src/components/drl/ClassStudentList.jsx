import React, { useState, useEffect, useCallback } from 'react';
import { getClassStudents } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import StudentAssessmentModal from './StudentAssessmentModal';

const ClassStudentList = ({ classCode, term, onListLoaded }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const fetchData = useCallback(async () => {
    if (!classCode || !term) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getClassStudents(classCode, term);
      setStudents(data);
      if (onListLoaded) onListLoaded(); // Callback cho component cha
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [classCode, term, onListLoaded]);

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
    if (error) return <div className="alert alert-danger">Lỗi tải danh sách sinh viên: {error}</div>;
    if (students.length === 0) return <div className="alert alert-info">Không có sinh viên trong lớp này.</div>;

    return (
      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>MSSV</th>
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
      <div className="card">
        <div className="card-header">
          <b>Lớp {classCode}</b> — Danh sách sinh viên
        </div>
        <div className="card-body">
          {renderContent()}
        </div>
      </div>

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