import React, { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Button, Form, Card } from 'react-bootstrap'; // Import components
import { useTerm } from '../../layout/DashboardLayout';
import { getAdminFaculties } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StudentAssessmentModal from '../../components/drl/StudentAssessmentModal';

const ViewFacultiesPage = () => {
  const { term } = useTerm();
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null); // { code, name }

  const fetchData = useCallback(async () => {
    if (!term) return;

    setLoading(true);
    setError(null);
    setSelectedStudent(null);
    try {
      const data = await getAdminFaculties(term);
      setFaculties(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [term]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleModalClose = () => {
    setSelectedStudent(null);
  };

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <Alert variant="danger">Lỗi tải danh sách khoa: {error}</Alert>;
    if (faculties.length === 0) {
      return <Alert variant="info">Không tìm thấy khoa nào.</Alert>;
    }

    return (
      <Table striped responsive className="align-middle">
        <thead>
          <tr>
            <th>MSV</th>
            <th>Họ tên</th>
            <th>Lớp</th>
            <th>Khoa</th>
            <th className='text-center'>Tổng điểm (Khoa)</th>
            <th className='text-center'>Tổng điểm (Trường)</th>
            <th></th>
          </tr>
          <tr>
            <th><Form.Control size="sm" ></Form.Control></th>
            <th><Form.Control size="sm" ></Form.Control></th>
            <th><Form.Control size="sm" ></Form.Control></th>
            <th><Form.Control size="sm" ></Form.Control></th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {faculties.map(f => (
            <tr key={f.student_code}>
              <td>{f.student_code}</td>
              <td>{f.full_name}</td>
              <td>{f.class_name}</td>
              <td>{f.faculty_name}</td>
              <td className='text-center'>{f.old_score ?? 0}</td>
              <td className='text-center'>{f.total_score ?? 0}</td> 
              <td>
                <Button
                  size="sm"
                  variant='success'
                  className="btn-main"
                  onClick={() => setSelectedStudent({ code: f.student_code})}
                >
                  Xem/Sửa
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
        <b>TỔNG HỢP SINH VIÊN</b>
      </div>

      <Card>
        <Card.Body>
          {renderContent()}
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-end">
        <Button
          className="btn-main mt-3"
          variant='success'
          size="sm"
        >
          Duyệt
        </Button>
      </div>
      {selectedStudent && (
        <StudentAssessmentModal
          studentCode={selectedStudent.code}
          term={term}
          onClose={handleModalClose}
        />
      )}
    </>
  );
};

export default ViewFacultiesPage;