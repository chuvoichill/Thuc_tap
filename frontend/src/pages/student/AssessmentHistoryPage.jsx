import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom'; // Dùng Link để xem chi tiết
import useAuth from '../../hooks/useAuth';
import { getStudentHistory } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const AssessmentHistoryPage = () => {
  const { user } = useAuth(); // Lấy thông tin sinh viên đang đăng nhập
  const [history, setHistory] = useState([]); // State lưu trữ lịch sử
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hàm gọi API để lấy lịch sử
  const fetchData = useCallback(async () => {
    if (!user?.student_code) return; // Đảm bảo đã có student_code
    setLoading(true);
    setError(null);
    try {
      const data = await getStudentHistory(user.student_code); // Gọi API service
      setHistory(data || []); // Cập nhật state, đảm bảo là array
    } catch (e) {
      setError('Không tải được lịch sử đánh giá: ' + e.message);
    }
    setLoading(false);
  }, [user?.student_code]);

  // Gọi fetchData khi component được mount hoặc student_code thay đổi
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hàm render nội dung chính (bảng lịch sử)
  const renderContent = () => {
    if (loading) return <LoadingSpinner />; // Hiển thị loading
    if (error) return <div className="alert alert-danger">{error}</div>; // Hiển thị lỗi
    if (history.length === 0) {
      // Hiển thị thông báo nếu không có dữ liệu
      return <div className="alert alert-info">Chưa có dữ liệu đánh giá từ các kỳ trước.</div>;
    }

    // Render bảng nếu có dữ liệu
    return (
      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>Học kỳ</th>
              <th className="text-end">Tổng điểm</th>
              <th>Xếp loại</th>
              <th></th> {/* Cột trống cho nút Xem chi tiết */}
            </tr>
          </thead>
          <tbody>
            {history.map(item => ( // Lặp qua từng kỳ trong lịch sử
              <tr key={item.term_code}>
                <td className="fw-bold">{item.term_code}</td>
                <td className="text-end">{item.total_score}</td>
                <td>
                  {/* Hiển thị xếp loại với màu sắc */}
                  <span className={`badge ${
                    item.rank === 'Xuất sắc' ? 'bg-success' :
                    item.rank === 'Tốt' ? 'bg-primary' :
                    item.rank === 'Khá' ? 'bg-info text-dark' :
                    item.rank === 'Trung bình' ? 'bg-secondary' :
                    item.rank === 'Yếu' ? 'bg-warning text-dark' :
                    item.rank === 'Kém' ? 'bg-danger' : 'bg-light text-dark'
                  }`}>
                    {item.rank || 'N/A'} {/* Hiển thị N/A nếu không có rank */}
                  </span>
                </td>
                <td className="text-end">
                   {/* Nút Link đến trang xem chi tiết của kỳ đó */}
                  <Link
                    to={`/self-history/${item.term_code}`} // URL chứa mã kỳ, ví dụ: /self-history/2025HK1
                    className="btn btn-sm btn-outline-secondary"
                  >
                    Xem chi tiết
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render component chính
  return (
    <>
      <div className='section-title mb-3'>
        <i className='bi bi-archive-fill me-2'></i>
        Lịch sử Đánh giá Rèn luyện
      </div>
      {renderContent()} {/* Gọi hàm render bảng */}
    </>
  );
};

export default AssessmentHistoryPage;