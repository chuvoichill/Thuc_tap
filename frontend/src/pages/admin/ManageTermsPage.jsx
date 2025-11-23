import { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Button, Badge, Spinner } from 'react-bootstrap'; // Import components
import useNotify from '../../hooks/useNotify'; 
import {
  getAdminTerms, createAdminTerm, updateAdminTerm, deleteAdminTerm,
  setTermAssessmentStatus
} from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner'; 
import TermFormModal from '../../components/admin/TermFormModal'; 

const ManageTermsPage = () => {
  const { notify } = useNotify();
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [termToEdit, setTermToEdit] = useState(null);
  const [updatingStatusTerm, setUpdatingStatusTerm] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminTerms();
      setTerms(data || []);
    } catch (e) {
      setError('Lỗi tải danh sách Học kỳ: ' + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (term = null) => {
    setTermToEdit(term);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTermToEdit(null);
  };

  const handleSaveTerm = async (termData, termCode) => {
    try {
      if (termCode) { 
        await updateAdminTerm(termCode, termData);
        notify('Cập nhật Học kỳ thành công!');
      } else { 
        await createAdminTerm(termData);
        notify('Thêm Học kỳ thành công!');
      }
      fetchData();
      return Promise.resolve();
    } catch (e) {
      notify(`Lỗi khi lưu Học kỳ: ${e.message}`, 'danger');
      return Promise.reject(e);
    }
  };

  const handleDeleteTerm = async (termCode) => {
    if (window.confirm(`Bạn có chắc muốn xóa Học kỳ "${termCode}"? Dữ liệu đánh giá của kỳ này có thể bị ảnh hưởng.`)) {
      try {
        await deleteAdminTerm(termCode);
        notify('Xóa Học kỳ thành công!', 'info');
        fetchData();
      } catch (e) {
        notify(`Lỗi khi xóa Học kỳ: ${e.message}`, 'danger');
      }
    }
  };

  const handleToggleAssessmentStatus = async (termCode, currentStatus) => {
    const action = currentStatus ? 'khóa' : 'mở';
    if (!window.confirm(`Bạn có chắc muốn ${action} đánh giá cho kỳ ${termCode}?`)) {
      return;
    }
    setUpdatingStatusTerm(termCode);
    try {
      const newStatus = !currentStatus;
      const result = await setTermAssessmentStatus(termCode, newStatus);
      notify(result.message || `Đã ${action} thành công!`, 'success');
      setTerms(prevTerms => prevTerms.map(t =>
        t.code === termCode ? { ...t, is_active: newStatus } : t
      ));
    } catch (e) {
      notify(`Lỗi khi ${action} đánh giá: ${e.message}`, 'danger');
    } finally {
      setUpdatingStatusTerm(null);
    }
  };

  const renderContent = () => {
     if (loading) return <LoadingSpinner />;
     if (error) return <Alert variant="danger">{error}</Alert>;
     if (terms.length === 0) return <Alert variant="info">Chưa có học kỳ nào.</Alert>

     return (
       <Table striped responsive className="align-middle" size="sm">
           <thead>
             <tr>
               <th>Mã Kỳ</th>
               <th>Tên Kỳ</th>
               <th>Năm-HK</th>
               <th>Trạng thái Kỳ</th>
               <th>Trạng thái ĐG</th>
               <th className="text-end">Thao tác</th>
             </tr>
           </thead>
           <tbody>
             {terms.map(t => {
               const isUpdating = updatingStatusTerm === t.code;
               return (
                 <tr key={t.code}>
                   <td>{t.code}</td>
                   <td>{t.title}</td>
                   <td>{t.year}-{t.semester}</td>
                   <td>
                     {/* Dùng Badge */}
                     {t.is_active ?
                       <Badge bg="primary">Đang hoạt động</Badge> :
                       <Badge bg="secondary">Đã kết thúc</Badge>
                     }
                   </td>
                   <td>
                     {/* Dùng Badge */}
                     {t.is_active ?
                       <Badge bg="success">Đang Mở ĐG</Badge> :
                       <Badge bg="danger">Đã Khóa ĐG</Badge>
                     }
                   </td>
                   <td className="text-end text-nowrap">
                     {/* Nút Khóa/Mở Đánh giá */}
                     <Button
                       size="sm"
                       variant={t.is_active ? 'warning' : 'success'}
                       onClick={() => handleToggleAssessmentStatus(t.code, t.is_active)}
                       disabled={isUpdating}
                       className="me-1"
                       style={{minWidth: '80px'}}
                     >
                       {isUpdating ? <Spinner animation="border" size="sm" /> : (t.is_active ? 'Khóa ĐG' : 'Mở ĐG')}
                     </Button>
                     {/* Nút Sửa */}
                     <Button
                       size="sm"
                       variant="outline-primary"
                       onClick={() => handleOpenModal(t)}
                       disabled={isUpdating}
                       className="me-1"
                     >
                       <i className="bi bi-pencil-square"></i> Sửa
                     </Button>
                     {/* Nút Xóa */}
                     <Button
                       size="sm"
                       variant="outline-danger"
                       onClick={() => handleDeleteTerm(t.code)}
                       disabled={isUpdating}
                     >
                        <i className="bi bi-trash"></i> Xóa
                     </Button>
                   </td>
                 </tr>
               );
             })}
           </tbody>
       </Table>
     );
  };

  return (
    <>
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <div className='section-title mb-0'>
          <i className='bi bi-calendar-event-fill me-2'></i> Quản lý Học kỳ & Trạng thái Đánh giá
        </div>
        <Button size="sm" className="btn-main" variant='success' onClick={() => handleOpenModal(null)}>
          <i className="bi bi-plus-lg me-1"></i> Thêm Học kỳ
        </Button>
      </div>

      {renderContent()}

      {showModal && (
        <TermFormModal
          termToEdit={termToEdit}
          onSave={handleSaveTerm}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default ManageTermsPage;