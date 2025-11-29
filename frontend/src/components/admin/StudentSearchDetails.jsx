import React, { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Badge, Button, Modal } from 'react-bootstrap'; // Import components
import { getStudentHistory } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ViewStudentDetailsSearch from './ViewStudentDetailsSearch';

const StudentSearchDetails = ({ user }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = (student_code, term_code) => {
    setShow(true);
    setSelectedStudent({ code: student_code, term: term_code })
  }

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

  // Hàm render nội dung chính (bảng lịch sử)
  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    // Dùng Alert variant="danger"
    if (error) return <Alert variant="danger">{error}</Alert>;
    // Dùng Alert variant="info"
    if (history.length === 0) {
      return <Alert variant="info">Chưa có dữ liệu đánh giá từ các kỳ trước.</Alert>;
    }

    return (
      // Dùng Table responsive
      <Table striped responsive className="align-middle">
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
                {/* Dùng Badge */}
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
                {/* Dùng Button variant="outline-primary" size="sm" */}
                <Button
                  variant="outline-success"
                  size="sm"
                  onClick={() => handleShow(user.student_code, item.term_code)}
                >
                  Xem chi tiết
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
      <div className='section-title mb-3'>
        <i className='bi bi-archive-fill me-2'></i>
        Lịch sử Đánh giá Rèn luyện
      </div>
      {renderContent()}

      <Modal show={show} size='lg' scrollable={true}  onHide={handleClose}>
        <Modal.Header closeButton>
        </Modal.Header>
        <Modal.Body>
          {selectedStudent && (
            <ViewStudentDetailsSearch
              student={{ student_code: selectedStudent.code, term: selectedStudent.term }}
            />
          )}
        </Modal.Body>
      </Modal>

    </>
  );
};

export default StudentSearchDetails;