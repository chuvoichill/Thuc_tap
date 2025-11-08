import React, { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Button } from 'react-bootstrap'; // Import components
import useNotify from '../../hooks/useNotify';
import { getAdminManageClasses, createAdminClass, updateAdminClass, deleteAdminClass, getAllFacultiesSimple } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ClassFormModal from '../../components/admin/ClassFormModal';

const ManageClassesPage = () => {
  const { notify } = useNotify();
  const [classes, setClasses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [classToEdit, setClassToEdit] = useState(null);

  const facultyMap = React.useMemo(() => {
    return new Map(faculties.map(f => [f.id, f.name]));
  }, [faculties]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [classData, facultyData] = await Promise.all([
          getAdminManageClasses(),
          getAllFacultiesSimple()
      ]);
      setClasses(classData || []);
      setFaculties(facultyData || []);
    } catch (e) { setError('Không tải được danh sách: ' + e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenModal = (cls = null) => { setClassToEdit(cls); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setClassToEdit(null); };

  const handleSaveClass = async (classData, classId) => {
    try {
      if (classId) {
        await updateAdminClass(classId, classData); notify('Cập nhật lớp thành công!');
      } else {
        await createAdminClass(classData); notify('Thêm lớp thành công!');
      }
      fetchData(); return Promise.resolve();
    } catch (e) { notify(`Lỗi: ${e.message}`, 'danger'); return Promise.reject(e); }
  };

  const handleDeleteClass = async (classId, classCode) => {
    if (window.confirm(`Xóa lớp "${classCode}"? Sinh viên trong lớp có thể bị ảnh hưởng.`)) {
      try {
        await deleteAdminClass(classId); notify('Xóa lớp thành công!', 'info'); fetchData();
      } catch (e) { notify(`Lỗi xóa: ${e.message}`, 'danger'); }
    }
  };

  const renderContent = () => {
      if (loading) return <LoadingSpinner />;
      if (error) return <Alert variant="danger">{error}</Alert>;
       if (classes.length === 0) return <Alert variant="info">Chưa có lớp học nào.</Alert>;

      return (
        <Table striped responsive className="align-middle" size="sm">
            <thead>
              <tr>
                <th>Mã Lớp</th>
                <th>Tên Lớp</th>
                <th>Khoa</th>
                <th className="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {classes.map(c => (
                <tr key={c.id}>
                  <td>{c.code}</td>
                  <td>{c.name}</td>
                  <td>{facultyMap.get(c.faculty_id) || c.faculty_id}</td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="outline-primary" className="me-1" onClick={() => handleOpenModal(c)}>
                       <i className="bi bi-pencil-square"></i> Sửa
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => handleDeleteClass(c.id, c.code)}>
                       <i className="bi bi-trash"></i> Xóa
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
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <div className='section-title mb-0'>
          <i className='bi bi-collection-fill me-2'></i> Quản lý Lớp học
        </div>
        <Button size="sm" variant="primary" onClick={() => handleOpenModal(null)}>
          <i className="bi bi-plus-lg me-1"></i> Thêm mới
        </Button>
      </div>
      {renderContent()}
      {showModal && (
        <ClassFormModal
          classToEdit={classToEdit}
          onSave={handleSaveClass}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default ManageClassesPage;