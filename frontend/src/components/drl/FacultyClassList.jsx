// frontend/src/components/drl/FacultyClassList.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useTerm } from '../../layout/DashboardLayout';
import useAuth from '../../hooks/useAuth';
import { getAdminClasses, getFacultyClasses } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import ClassStudentList from './ClassStudentList';
import HSVStudentList from './HSVStudentList';

const FacultyClassList = ({ title, facultyCode, facultyName }) => {
  const { term } = useTerm();
  const { user } = useAuth();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);

  const fetchData = useCallback(async () => {
    if (!term || !user?.role) return;

    setLoading(true);
    setError(null);
    setSelectedClass(null);

    try {
      let res;
      if (user.role === 'faculty') {
        // Faculty → API của khoa
        res = await getFacultyClasses(user.username, term);
      } else if (user.role === 'admin') {
        // Admin → API admin (cần facultyCode)
        if (!facultyCode) throw new Error('Thiếu facultyCode cho admin');
        res = await getAdminClasses(term, facultyCode);
      } else {
        setClasses([]);
        return;
      }

      const data = res?.data ?? res ?? [];
      setClasses(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Fetch error');
    } finally {
      setLoading(false);
    }
  }, [term, user?.role, user?.username, facultyCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const computedTitle =
    title ??
    (user?.role === 'faculty'
      ? `Tổng hợp theo lớp – Khoa ${user?.faculty_code || ''} – Kỳ ${term}`
      : user?.role === 'admin'
      ? `Khoa ${facultyName || facultyCode || ''} — Danh sách lớp`
      : 'Danh sách lớp');

  return (
    <>
      <div className="card mb-3">
        <div className="card-header"><b>{computedTitle}</b></div>
        <div className="card-body">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <div className="alert alert-danger">Lỗi: {error}</div>
          ) : !classes.length ? (
            <div className="alert alert-info">Không có lớp.</div>
          ) : (
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
                  {classes.map((c) => (
                    <tr key={c.class_code}>
                      <td>{c.class_code}</td>
                      <td>{c.class_name}</td>
                      <td className="text-end">{c.total_students ?? 0}</td>
                      <td className="text-end">{c.completed ?? 0}</td>
                      <td className="text-end">
                        {c.avg_score == null ? '—' : Number(c.avg_score).toFixed(2)}
                      </td>
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
          )}
        </div>
      </div>

        {selectedClass && (
        <div className="mt-3">
          {user?.role === 'hsv' ? (
            // ktra HSV role
            <HSVStudentList 
              classCode={selectedClass} 
              term={term} />
          ) : (
            // Admin/Faculty xem danh sách SV theo lớp
            <ClassStudentList classCode={selectedClass} term={term} />
          )}
        </div>
      )}


      
    </>
  );
}
export default FacultyClassList;
