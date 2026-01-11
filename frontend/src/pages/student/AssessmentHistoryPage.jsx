import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Table, Badge, Alert, Container} from 'react-bootstrap'; 
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <Alert variant="danger">{error}</Alert>;
    if (history.length === 0) {
      return <Alert variant="info">Chưa có dữ liệu đánh giá từ các kỳ trước.</Alert>;
    }
    return (
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
                <Badge pill bg={
                  item.rank === 'Xuất sắc' ? 'success' :
                    item.rank === 'Tốt' ? 'primary' :
                      item.rank === 'Khá' ? 'info' : 
                        item.rank === 'Trung bình' ? 'secondary' :
                          item.rank === 'Yếu' ? 'warning' :
                            item.rank === 'Kém' ? 'danger' : 'light'
                } className={
                  (item.rank === 'Khá' || item.rank === 'Yếu' || item.rank === 'N/A') ? 'text-dark' : ''
                }>
                  {item.rank || 'N/A'}
                </Badge>
              </td>
              <td className="text-end">
                <Link
                  to={`/self-history/${item.term_code}`}
                  className="btn btn-success btn-sm btn-main" 
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
  return (
    <Container fluid>
      <div className='section-title mb-3'>
        <b>LỊCH SỬ ĐIỂM RÈN LUYỆN</b>
      </div>
      {renderContent()}
    </Container>
  );
};

export default AssessmentHistoryPage;