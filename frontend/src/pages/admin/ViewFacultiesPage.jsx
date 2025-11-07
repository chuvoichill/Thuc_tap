import React, { useState, useEffect, useCallback } from 'react';
import { useTerm } from '../../layout/DashboardLayout';
import { getAdminFaculties } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import FacultyClassList from '../../components/drl/FacultyClassList'; // Import component vừa tạo

const ViewFacultiesPage = () => {
  const { term } = useTerm();
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFaculty, setSelectedFaculty] = useState(null); // { code, name }

  const fetchData = useCallback(async () => {
    if (!term) return;
    
    setLoading(true);
    setError(null);
    setSelectedFaculty(null); // Reset lựa chọn
    try {
      const data = await getAdminFaculties(term);
      setFaculties(data);
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
    if (error) return <div className="alert alert-danger">Lỗi tải danh sách khoa: {error}</div>;
    if (faculties.length === 0) {
      return <div className="alert alert-info">Không tìm thấy khoa nào.</div>;
    }

    return (
      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>Mã khoa</th>
              <th>Tên khoa</th>
              <th className="text-end">Số SV</th>
              <th className="text-end">Đã tự đánh giá</th>
              <th className="text-end">ĐRL TB</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {faculties.map(f => (
              <tr key={f.faculty_code}>
                <td>{f.faculty_code}</td>
                <td>{f.faculty_name}</td>
                <td className="text-end">{f.total_students ?? 0}</td>
                <td className="text-end">{f.completed ?? 0}</td>
                <td className="text-end">{f.avg_score ?? 0}</td>
                <td className="text-end">
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setSelectedFaculty({ code: f.faculty_code, name: f.faculty_name })}
                  >
                    Xem lớp
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
        <i className='bi bi-building me-2'></i>
        Tổng hợp theo khoa – Kỳ <b>{term}</b>
      </div>
      
      {renderContent()}

      {/* Khi chọn một khoa, component FacultyClassList sẽ hiện ra */}
      {selectedFaculty && (
        <div className="mt-3">
          <FacultyClassList
            facultyCode={selectedFaculty.code}
            facultyName={selectedFaculty.name}
            term={term}
            title={`Lớp thuộc khoa ${selectedFaculty.name} – Kỳ ${term}`}
          />
        </div>
      )}
    </>
  );
};

export default ViewFacultiesPage;