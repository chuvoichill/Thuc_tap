import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Alert } from 'react-bootstrap'; // Import components
import { getHSVClassStudents } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import HSVStudentRow from './HSVStudentRow'; 

const HSVStudentList = ({ classCode, term }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!classCode || !term) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getHSVClassStudents(classCode, term);
      setStudents(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [classCode, term]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    // Dùng Alert variant="danger"
    if (error) return <Alert variant="danger">Lỗi tải danh sách sinh viên: {error}</Alert>;
    // Dùng Alert variant="info"
    if (students.length === 0) return <Alert variant="info">Không có sinh viên trong lớp này.</Alert>;

    return (
      // Dùng Table responsive
      <Table striped responsive className="align-middle">
          <thead>
            <tr>
              <th>MSSV</th>
              <th>Họ tên</th>
              <th className="text-center">Điểm 2.1</th>
              <th className="text-center">Tham gia</th>
              <th>Ghi chú</th>
              <th className="text-end">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <HSVStudentRow
                key={s.student_code}
                student={s}
                term={term}
              />
            ))}
          </tbody>
      </Table>
    );
  };

  return (
    // Dùng Card
    <Card>
      <Card.Header>
        <b>Lớp {classCode}</b> — Xác nhận tiêu chí 2.1
      </Card.Header>
      <Card.Body>
        {renderContent()}
      </Card.Body>
    </Card>
  );
};

export default HSVStudentList;