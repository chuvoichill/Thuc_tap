import React, { useState, useEffect, useCallback } from 'react';
import { getHSVClassStudents } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import HSVStudentRow from './HSVStudentRow'; // Import component con

const HSVStudentList = ({ classCode, term }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!classCode || !term) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getHSVClassStudents(classCode, term);
      setStudents(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [classCode, term]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
              <th className="text-center">Điểm 2.1</th>
              <th className="text-center">Tham gia</th>
              <th>Ghi chú</th>
              <th className="text-end">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {/* Sử dụng component HSVStudentRow cho từng dòng.
              Mỗi dòng sẽ tự quản lý state của nó.
            */}
            {students.map(s => (
              <HSVStudentRow
                key={s.student_code}
                student={s}
                term={term}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="card-header">
        <b>Lớp {classCode}</b> — Xác nhận tiêu chí 2.1
      </div>
      <div className="card-body">
        {renderContent()}
      </div>
    </div>
  );
};

export default HSVStudentList;