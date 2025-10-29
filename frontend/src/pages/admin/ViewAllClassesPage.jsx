import React, { useState, useEffect, useCallback } from 'react';
import { useTerm } from '../../layout/DashboardLayout';
import { getAdminClasses } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ClassStudentList from '../../components/drl/ClassStudentList';

const ViewAllClassesPage = () => {
  const { term } = useTerm();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null); // Lưu mã lớp đang chọn

  const fetchData = useCallback(async () => {
    if (!term) return;
    
    setLoading(true);
    setError(null);
    setSelectedClass(null);
    try {
      // Gọi API admin/classes không có filter faculty
      const data = await getAdminClasses(term);
      setClasses(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [term]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <div className="alert alert-danger">Lỗi tải danh sách lớp: {error}</div>;
    if (classes.length === 0) {
      return <div className="alert alert-info">Không tìm thấy lớp nào.</div>;
    }

    return (
      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>Khoa</th>
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
                <td>{c.faculty_code}</td>
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
      <div className='section-title mb-3'>
        <i className='bi bi-people me-2'></i>
        Tổng hợp toàn bộ các lớp – Kỳ <b>{term}</b>
      </div>
      
      {renderContent()}

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

export default ViewAllClassesPage;