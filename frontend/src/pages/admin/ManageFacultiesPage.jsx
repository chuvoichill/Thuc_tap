import React, { useState, useEffect, useCallback } from 'react';
import useNotify from '../../hooks/useNotify';
import { getAdminManageFaculties, createAdminFaculty, updateAdminFaculty, deleteAdminFaculty } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import FacultyFormModal from '../../components/admin/FacultyFormModal.jsx';

const ManageFacultiesPage = () => {
  const { notify } = useNotify();
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [facultyToEdit, setFacultyToEdit] = useState(null);

  const fetchData = useCallback(async () => {
     setLoading(true); setError(null);
     try {
       const data = await getAdminManageFaculties();
       setFaculties(data || []);
     } catch (e) { setError('Lỗi tải Khoa: ' + e.message); }
     setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenModal = (fac = null) => { setFacultyToEdit(fac); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setFacultyToEdit(null); };

  const handleSaveFaculty = async (facultyData, facultyId) => {
    try {
      if (facultyId) {
        await updateAdminFaculty(facultyId, facultyData); notify('Cập nhật Khoa thành công!');
      } else {
        await createAdminFaculty(facultyData); notify('Thêm Khoa thành công!');
      }
      fetchData(); return Promise.resolve();
    } catch (e) { notify(`Lỗi: ${e.message}`, 'danger'); return Promise.reject(e); }
  };

  const handleDeleteFaculty = async (facultyId, facultyCode) => {
    if (window.confirm(`Xóa Khoa "${facultyCode}"? Cảnh báo: Lớp và Sinh viên thuộc khoa này có thể bị ảnh hưởng.`)) {
      try {
        await deleteAdminFaculty(facultyId); notify('Xóa Khoa thành công!', 'info'); fetchData();
      } catch (e) {
         if (e.response?.data?.error === 'faculty_in_use') { // Bắt lỗi cụ thể từ backend (nếu có)
            notify('Không thể xóa Khoa đang được sử dụng bởi Lớp học.', 'warning');
         } else {
            notify(`Lỗi xóa Khoa: ${e.message}`, 'danger');
         }
      }
    }
  };

  const renderContent = () => {
      if (loading) return <LoadingSpinner />;
      if (error) return <div className="alert alert-danger">{error}</div>;
      if (faculties.length === 0) return <div className="alert alert-info">Chưa có Khoa nào.</div>;
      return (
        <div className="table-responsive">
          <table className="table table-striped align-middle table-sm">
            <thead><tr><th>Mã Khoa</th><th>Tên Khoa</th><th className="text-end">Thao tác</th></tr></thead>
            <tbody>
              {faculties.map(f => (
                <tr key={f.id}>
                  <td>{f.code}</td><td>{f.name}</td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-primary me-1" onClick={() => handleOpenModal(f)}>
                      <i className="bi bi-pencil-square"></i> Sửa
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteFaculty(f.id, f.code)}>
                       <i className="bi bi-trash"></i> Xóa
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
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <div className='section-title mb-0'>
          <i className='bi bi-buildings-fill me-2'></i> Quản lý Khoa
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => handleOpenModal(null)}>
          <i className="bi bi-plus-lg me-1"></i> Thêm mới
        </button>
      </div>
      {renderContent()}
      {showModal && (
        <FacultyFormModal
          facultyToEdit={facultyToEdit}
          onSave={handleSaveFaculty}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default ManageFacultiesPage;