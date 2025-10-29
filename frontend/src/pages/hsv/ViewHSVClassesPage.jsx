import React, { useState, useEffect, useCallback } from 'react';
import { useTerm } from '../../layout/DashboardLayout';
import useAuth from '../../hooks/useAuth';
import { getHSVClasses } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import HSVStudentList from '../../components/drl/HSVStudentList'; // Import component vừa tạo

const ViewHSVClassesPage = () => {
  const { term } = useTerm();
  const { user } = useAuth();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null); // Lưu mã lớp đang chọn

  const fetchData = useCallback(async () => {
    if (!term || !user?.username) return;
    
    setLoading(true);
    setError(null);
    setSelectedClass(null); // Reset lựa chọn lớp khi đổi kỳ
    try {
      const data = await getHSVClasses(user.username, term);
      setClasses(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [term, user?.username]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <div className="alert alert-danger">Lỗi tải danh sách lớp: {error}</div>;
    if (classes.length === 0) {
      return <div className="alert alert-info">Không tìm thấy lớp nào.</div>;
    }

    // Kiểm tra xem API có trả về faculty_code không (dành cho admin/HSV trường)
    const showFaculty = classes.length > 0 && classes[0].faculty_code;

    return (
      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              {showFaculty && <th>Khoa</th>}
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
                {showFaculty && <td>{c.faculty_code}</td>}
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
        HSV – Xác nhận hoạt động ĐTN/HSV (tiêu chí 2.1) – Kỳ <b>{term}</b>
      </div>
      
      {renderContent()}

      {/* Khi chọn một lớp, component HSVStudentList sẽ hiện ra */}
      {selectedClass && (
        <div className="mt-3">
          <HSVStudentList
            classCode={selectedClass}
            term={term}
          />
        </div>
      )}
    </>
  );
};

export default ViewHSVClassesPage;