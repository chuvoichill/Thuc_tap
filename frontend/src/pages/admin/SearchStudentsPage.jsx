import React, { useState, useCallback } from 'react';
import { useTerm } from '../../layout/DashboardLayout'; // Lấy term từ layout
import { searchAdminStudents } from '../../services/drlService'; // API tìm kiếm
import LoadingSpinner from '../../components/common/LoadingSpinner'; // Component loading
import StudentAssessmentModal from '../../components/drl/StudentAssessmentModal'; // Modal xem/sửa điểm (tái sử dụng)
import StudentSearchDetails from '../../components/admin/StudentSearchDetails';

const SearchStudentsPage = () => {
  const { term } = useTerm(); // Học kỳ đang chọn
  // State lưu trữ các tiêu chí tìm kiếm
  const [searchParams, setSearchParams] = useState({ studentCode: '', name: '', classCode: '' });
  // State lưu kết quả tìm kiếm
  const [results, setResults] = useState(null); // null: chưa tìm, []: rỗng, [...]: có kết quả
  const [loading, setLoading] = useState(false); // State đang tìm kiếm
  const [error, setError] = useState(null); // State lỗi
  const [selectedStudent, setSelectedStudent] = useState(null); // Sinh viên đang được chọn để xem/sửa điểm

  // Cập nhật state khi người dùng nhập liệu
  const handleInputChange = (e) => {
    setSearchParams({ ...searchParams, [e.target.name]: e.target.value });
  };

  // Xử lý khi bấm nút tìm kiếm
  const handleSearch = useCallback(async (e) => {
    e.preventDefault(); // Ngăn form submit mặc định
    // Kiểm tra xem có nhập ít nhất 1 ô không
    if (!searchParams.studentCode && !searchParams.name && !searchParams.classCode) {
      setError('Vui lòng nhập ít nhất một tiêu chí tìm kiếm.');
      setResults(null); // Xóa kết quả cũ (nếu có)
      return;
    }

    setLoading(true); // Bắt đầu tìm
    setError(null); // Xóa lỗi cũ
    setResults(null); // Xóa kết quả cũ
    setSelectedStudent(null); // Đóng modal (nếu đang mở)
    try {
      // Gọi API tìm kiếm
      const data = await searchAdminStudents(searchParams);
      setResults(data || []); // Lưu kết quả, đảm bảo là array
    } catch (e) {
      setError('Lỗi khi tìm kiếm: ' + e.message); // Báo lỗi
      setResults([]); // Đặt là mảng rỗng để biết là đã tìm nhưng lỗi/không thấy
    }
    setLoading(false); // Kết thúc tìm
  }, [term, searchParams]); // Dependency: chạy lại nếu term hoặc searchParams thay đổi

  // Xử lý khi đóng modal xem/sửa điểm
  const handleModalClose = (didSave) => {
     setSelectedStudent(null); // Đóng modal
     // Không cần tải lại kết quả tìm kiếm sau khi lưu modal ở trang này
  };

  return (
    <>
      {/* Tiêu đề trang */}
      <div className='section-title mb-3'>
        <i className='bi bi-binoculars me-2'></i>
        Tìm kiếm Sinh viên – Kỳ <b>{term}</b>
      </div>

      {/* Form tìm kiếm */}
      <form onSubmit={handleSearch} className="card card-body mb-3">
        <div className="row g-2 align-items-end">
          {/* Input MSSV */}
          <div className="col-md-3">
            <label className="form-label form-label-sm">MSSV</label>
            <input
              type="text"
              className="form-control form-control-sm"
              name="studentCode"
              value={searchParams.studentCode}
              onChange={handleInputChange}
              placeholder="Nhập MSSV..."
            />
          </div>
          {/* Input Họ Tên */}
          <div className="col-md-4">
            <label className="form-label form-label-sm">Họ Tên</label>
            <input
              type="text"
              className="form-control form-control-sm"
              name="name"
              value={searchParams.name}
              onChange={handleInputChange}
              placeholder="Nhập họ tên..."
            />
          </div>
          {/* Input Mã Lớp */}
          <div className="col-md-3">
            <label className="form-label form-label-sm">Mã Lớp</label>
            <input
              type="text"
              className="form-control form-control-sm"
              name="classCode"
              value={searchParams.classCode}
              onChange={handleInputChange}
              placeholder="Nhập mã lớp..."
            />
          </div>
          {/* Nút Tìm */}
          <div className="col-md-2">
            <button type="submit" className="btn btn-primary btn-sm w-100" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm"></span> : <i className="bi bi-search me-1"></i>}
               Tìm
            </button>
          </div>
        </div>
        {/* Hiển thị lỗi tìm kiếm (nếu có) */}
        {error && <div className="text-danger mt-2 small">{error}</div>}
      </form>

      {/* Hiển thị loading khi đang tìm */}
      {loading && <LoadingSpinner />}

      {/* Hiển thị kết quả sau khi tìm xong */}
      {results && !loading && (
        <div className="card card-body mt-3"> {/* Thêm mt-3 */}
          <h5>Kết quả tìm kiếm ({results.length})</h5>
          {results.length === 0 ? (
             // Thông báo nếu không tìm thấy
             <div className="alert alert-warning mb-0">Không tìm thấy sinh viên nào phù hợp.</div>
          ) : (
            // Bảng kết quả nếu tìm thấy
            <div className="table-responsive">
              <table className="table table-sm table-striped align-middle mb-0"> {/* mb-0 */}
                <thead>
                  <tr>
                    <th>MSSV</th>
                    <th>Họ tên</th>
                    <th>Lớp</th>
                    <th className="text-end">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(s => (
                    <tr key={s.student_code}>
                      <td>{s.student_code}</td>
                      <td>{s.full_name}</td>
                      <td>{s.code}</td>
                      <td className="text-end">
                        {/* Nút mở modal xem/sửa điểm */}
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setSelectedStudent({ code: s.student_code, name: s.full_name })}
                        >
                          Xem/Sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Render Modal xem/sửa điểm khi selectedStudent có giá trị */}
      {selectedStudent && (
        <StudentSearchDetails
          user={{ student_code: selectedStudent.code}}
        />
      )}
    </>
  );
};

export default SearchStudentsPage;