import React, { useState, useEffect, useCallback } from 'react';
import { getAdminClasses } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import ClassStudentList from './ClassStudentList'; // Tái sử dụng

const FacultyClassList = ({ facultyCode, facultyName, term }) => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);

  const fetchData = useCallback(async () => {
    if (!facultyCode || !term) return;
    setLoading(true);
    setError(null);
    setSelectedClass(null); // Reset khi đổi khoa
    try {
      // Gọi API admin/classes với filter "faculty"
      const data = await getAdminClasses(term, facultyCode);
      setClasses(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [facultyCode, term]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <div className="alert alert-danger">Lỗi tải danh sách lớp: {error}</div>;
    if (classes.length === 0) return <div className="alert alert-info">Không có lớp nào trong khoa này.</div>;

    return (
      <div className="table-responsive">
        <table className="table table-striped align-middle">
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
            {classes.map(c => (
              <tr key={c.class_code}>
                <td>{c.class_code}</td>
                <td>{c.class_name}</td>
                <td className="text-end">{c.total_students ?? 0}</td>
                <td className="text-end">{c.completed ?? 0}</td>
                <td className="text-end">{c.avg_score ?? 0}</td>
                <td className="text-end">
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setSelectedClass(c.class_code)}
                  >
                    Xem sinh viên
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
          <b>Khoa {facultyName || facultyCode}</b> — Danh sách lớp
        </div>
        <div className="card-body">
          {renderContent()}
        </div>
      </div>

      {/* Khi chọn một lớp, component ClassStudentList sẽ hiện ra */}
      {selectedClass && (
        <div className="mt-3">
          <ClassStudentList
            classCode={selectedClass}
            term={term}
          />
        </div>
      )}
    </>
  );
};

export default FacultyClassList;