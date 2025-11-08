import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Table, Badge, Alert, Container, Button } from 'react-bootstrap'; // Import components
import useAuth from '../../hooks/useAuth';
import { getStudentHistory } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const AssessmentHistoryPage = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hàm gọi API để lấy lịch sử
  const fetchData = useCallback(async () => {
    if (!user?.student_code) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getStudentHistory(user.student_code);
      setHistory(data || []);
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
    if (loading) return <LoadingSpinner />;
    // Thay thế div.alert.alert-danger bằng Alert variant="danger"
    if (error) return <Alert variant="danger">{error}</Alert>;
    if (history.length === 0) {
      // Thay thế div.alert.alert-info bằng Alert variant="info"
      return <Alert variant="info">Chưa có dữ liệu đánh giá từ các kỳ trước.</Alert>;
    }

    // Render bảng sử dụng component Table
    return (
      // Xóa div.table-responsive, dùng Table responsive thay thế
      <Table striped hover responsive className="align-middle">
          <thead>
            <tr>
              <th>Học kỳ</th>
              <th className="text-end">Tổng điểm</th>
              <th>Xếp loại</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.map(item => (
              <tr key={item.term_code}>
                <td className="fw-bold">{item.term_code}</td>
                <td className="text-end">{item.total_score}</td>
                <td>
                  {/* Dùng component Badge */}
                  <Badge pill bg={
                    item.rank === 'Xuất sắc' ? 'success' :
                    item.rank === 'Tốt' ? 'primary' :
                    item.rank === 'Khá' ? 'info' : // Info trong react-bootstrap có màu nền nhạt hơn, tự động chuyển text-dark
                    item.rank === 'Trung bình' ? 'secondary' :
                    item.rank === 'Yếu' ? 'warning' :
                    item.rank === 'Kém' ? 'danger' : 'light'
                  } className={
                    (item.rank === 'Khá' || item.rank === 'Yếu' || item.rank === 'N/A') ? 'text-dark' : '' // Thêm class text-dark cho các màu nền sáng
                  }>
                    {item.rank || 'N/A'}
                  </Badge>
                </td>
                <td className="text-end">
                  {/* Dùng component Button */}
                  <Link
                    to={`/self-history/${item.term_code}`}
                    // Thay thế btn.btn-sm.btn-outline-secondary bằng variant="outline-secondary" size="sm"
                    as={Button}
                    variant="outline-secondary"
                    size="sm"
                  >
                    Xem chi tiết
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
      </Table>
    );
  };

  // Render component chính
  return (
    <Container fluid>
      <div className='section-title mb-3'>
        <i className='bi bi-archive-fill me-2'></i>
        Lịch sử Đánh giá Rèn luyện
      </div>
      {renderContent()}
    </Container>
  );
};

export default AssessmentHistoryPage;