import React, { useState, useEffect, useCallback } from 'react';
import useNotify from '../../hooks/useNotify'; // Hook để hiển thị thông báo
// Import các hàm API service cần thiết
import {
  getAdminTerms,
  createAdminTerm,
  updateAdminTerm,
  deleteAdminTerm,
  setTermAssessmentStatus
} from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner'; // Component loading
import TermFormModal from '../../components/admin/TermFormModal'; // Import modal vừa tạo

const ManageTermsPage = () => {
  const { notify } = useNotify(); // Lấy hàm notify từ context
  const [terms, setTerms] = useState([]); // State lưu danh sách học kỳ
  const [loading, setLoading] = useState(true); // State đang tải dữ liệu
  const [error, setError] = useState(null); // State lưu lỗi
  const [showModal, setShowModal] = useState(false); // State hiển thị/ẩn modal
  const [termToEdit, setTermToEdit] = useState(null); // State lưu học kỳ đang được sửa (null là tạo mới)
  const [updatingStatusTerm, setUpdatingStatusTerm] = useState(null); // State lưu mã kỳ đang cập nhật trạng thái (để disable nút)

  // Hàm tải danh sách học kỳ từ API
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Gọi API getAdminTerms (đã sửa ở backend để trả về is_assessment_open)
      // Sắp xếp kỳ mới nhất lên đầu
      const data = await getAdminTerms({ sortBy: 'year_desc,semester_desc' });
      setTerms(data || []); // Cập nhật state, đảm bảo là array
    } catch (e) {
      setError('Lỗi tải danh sách Học kỳ: ' + e.message); // Báo lỗi nếu có
    }
    setLoading(false); // Kết thúc tải
  }, []); // Hàm này không có dependency, chỉ chạy 1 lần

  // Gọi fetchData khi component được mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hàm mở modal (có thể truyền term để sửa, hoặc null để tạo mới)
  const handleOpenModal = (term = null) => {
    setTermToEdit(term); // Set học kỳ cần sửa
    setShowModal(true); // Hiển thị modal
  };

  // Hàm đóng modal
  const handleCloseModal = () => {
    setShowModal(false); // Ẩn modal
    setTermToEdit(null); // Reset học kỳ cần sửa
  };

  // Hàm xử lý khi lưu dữ liệu từ modal (được gọi bởi TermFormModal)
  const handleSaveTerm = async (termData, termCode) => {
    try {
      if (termCode) { // Nếu có termCode -> đang sửa
        await updateAdminTerm(termCode, termData); // Gọi API update
        notify('Cập nhật Học kỳ thành công!'); // Thông báo thành công
      } else { // Nếu không có termCode -> đang tạo mới
        await createAdminTerm(termData); // Gọi API create
        notify('Thêm Học kỳ thành công!'); // Thông báo thành công
      }
      fetchData(); // Tải lại danh sách sau khi lưu
      return Promise.resolve(); // Trả về Promise thành công để modal tự đóng
    } catch (e) {
      // Thông báo lỗi và không đóng modal
      notify(`Lỗi khi lưu Học kỳ: ${e.message}`, 'danger');
      return Promise.reject(e); // Trả về Promise thất bại
    }
  };

  // Hàm xử lý khi xóa học kỳ
  const handleDeleteTerm = async (termCode) => {
    // Hiển thị hộp thoại xác nhận
    if (window.confirm(`Bạn có chắc muốn xóa Học kỳ "${termCode}"? Dữ liệu đánh giá của kỳ này có thể bị ảnh hưởng.`)) {
      try {
        await deleteAdminTerm(termCode); // Gọi API xóa
        notify('Xóa Học kỳ thành công!', 'info'); // Thông báo thành công (dùng màu info)
        fetchData(); // Tải lại danh sách
      } catch (e) {
        notify(`Lỗi khi xóa Học kỳ: ${e.message}`, 'danger'); // Thông báo lỗi
      }
    }
  };

  // Hàm xử lý khi bấm nút Khóa/Mở đánh giá
  const handleToggleAssessmentStatus = async (termCode, currentStatus) => {
    const action = currentStatus ? 'khóa' : 'mở'; // Xác định hành động (khóa hay mở)
    // Hiển thị hộp thoại xác nhận
    if (!window.confirm(`Bạn có chắc muốn ${action} đánh giá cho kỳ ${termCode}?`)) {
      return; // Không làm gì nếu người dùng hủy
    }
    setUpdatingStatusTerm(termCode); // Đánh dấu là đang cập nhật trạng thái cho kỳ này (để disable nút)
    try {
      const newStatus = !currentStatus; // Trạng thái mới sẽ là ngược lại trạng thái cũ
      const result = await setTermAssessmentStatus(termCode, newStatus); // Gọi API cập nhật status
      notify(result.message || `Đã ${action} thành công!`, 'success'); // Thông báo thành công
      // Cập nhật lại state của terms ngay lập tức (không cần gọi fetchData)
      setTerms(prevTerms => prevTerms.map(t =>
        t.code === termCode ? { ...t, is_assessment_open: newStatus } : t
      ));
    } catch (e) {
      notify(`Lỗi khi ${action} đánh giá: ${e.message}`, 'danger'); // Thông báo lỗi
    } finally {
      setUpdatingStatusTerm(null); // Kết thúc cập nhật, enable lại nút
    }
  };

  // Hàm render nội dung chính (bảng danh sách)
  const renderContent = () => {
     if (loading) return <LoadingSpinner />;
     if (error) return <div className="alert alert-danger">{error}</div>;
     if (terms.length === 0) return <div className="alert alert-info">Chưa có học kỳ nào.</div>

     return (
       <div className="table-responsive">
         <table className="table table-striped align-middle table-sm"> {/* table-sm cho gọn hơn */}
           <thead>
             <tr>
               <th>Mã Kỳ</th>
               <th>Tên Kỳ</th>
               <th>Năm-HK</th>
               {/* Có thể ẩn bớt cột ngày tháng cho gọn */}
               {/* <th>Bắt đầu</th> */}
               {/* <th>Kết thúc</th> */}
               <th>Trạng thái Kỳ</th>
               <th>Trạng thái ĐG</th> {/* Cột trạng thái đánh giá */}
               <th className="text-end">Thao tác</th> {/* Cột thao tác */}
             </tr>
           </thead>
           <tbody>
             {terms.map(t => {
               // Kiểm tra xem có đang cập nhật status của dòng này không
               const isUpdating = updatingStatusTerm === t.code;
               return (
                 <tr key={t.code}>
                   <td>{t.code}</td>
                   <td>{t.title}</td>
                   <td>{t.year}-{t.semester}</td>
                   {/* <td>{t.start_date?.split('T')[0]}</td> */}
                   {/* <td>{t.end_date?.split('T')[0]}</td> */}
                   {/* Trạng thái hoạt động của kỳ */}
                   <td>
                     {t.is_active ?
                       <span className="badge bg-primary">Đang hoạt động</span> :
                       <span className="badge bg-secondary">Đã kết thúc</span>
                     }
                   </td>
                   {/* Trạng thái Mở/Khóa đánh giá */}
                   <td>
                     {t.is_assessment_open ?
                       <span className="badge bg-success">Đang Mở ĐG</span> :
                       <span className="badge bg-danger">Đã Khóa ĐG</span>
                     }
                   </td>
                   {/* Các nút thao tác */}
                   <td className="text-end text-nowrap"> {/* text-nowrap để nút không bị xuống dòng */}
                     {/* Nút Khóa/Mở Đánh giá */}
                     <button
                       className={`btn btn-sm me-1 ${t.is_assessment_open ? 'btn-warning' : 'btn-success'}`} // Màu nút thay đổi theo trạng thái
                       onClick={() => handleToggleAssessmentStatus(t.code, t.is_assessment_open)}
                       disabled={isUpdating} // Disable nút khi đang xử lý
                       style={{minWidth: '80px'}} // Giữ độ rộng nút ổn định
                     >
                       {isUpdating ? <span className="spinner-border spinner-border-sm"></span> : (t.is_assessment_open ? 'Khóa ĐG' : 'Mở ĐG')}
                     </button>
                     {/* Nút Sửa */}
                     <button
                       className="btn btn-sm btn-outline-primary me-1"
                       onClick={() => handleOpenModal(t)}
                       disabled={isUpdating} // Disable khi đang cập nhật status
                     >
                       <i className="bi bi-pencil-square"></i> Sửa
                     </button>
                     {/* Nút Xóa */}
                     <button
                       className="btn btn-sm btn-outline-danger"
                       onClick={() => handleDeleteTerm(t.code)}
                       disabled={isUpdating} // Disable khi đang cập nhật status
                     >
                        <i className="bi bi-trash"></i> Xóa
                     </button>
                   </td>
                 </tr>
               );
             })}
           </tbody>
         </table>
       </div>
     );
  };

  // Render component chính
  return (
    <>
      <div className='d-flex justify-content-between align-items-center mb-3'>
        {/* Tiêu đề trang */}
        <div className='section-title mb-0'>
          <i className='bi bi-calendar-event-fill me-2'></i> Quản lý Học kỳ & Trạng thái Đánh giá
        </div>
        {/* Nút thêm mới */}
        <button className="btn btn-primary btn-sm" onClick={() => handleOpenModal(null)}>
          <i className="bi bi-plus-lg me-1"></i> Thêm Học kỳ
        </button>
      </div>

      {renderContent()} {/* Render bảng danh sách */}

      {/* Render modal nếu showModal là true */}
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