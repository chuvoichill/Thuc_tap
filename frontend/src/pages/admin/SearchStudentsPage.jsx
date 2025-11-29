import React, { useState, useCallback } from 'react';
import { Card, Form, Row, Col, Button, Table, Alert, Spinner, Modal } from 'react-bootstrap'; // Import components
import { useTerm } from '../../layout/DashboardLayout';
import { searchAdminStudents } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StudentSearchDetails from '../../components/admin/StudentSearchDetails';

const SearchStudentsPage = () => {
  const { term } = useTerm();
  const [searchParams, setSearchParams] = useState({ studentCode: '', name: '', classCode: '' });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = (student_code, full_name) => {
    setShow(true);
    setSelectedStudent({ code: student_code, name: full_name })
  }
  const handleInputChange = (e) => {
    setSearchParams({ ...searchParams, [e.target.name]: e.target.value });
  };

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchParams.studentCode && !searchParams.name && !searchParams.classCode) {
      setError('Vui lòng nhập ít nhất một tiêu chí tìm kiếm.');
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setSelectedStudent(null);
    try {
      const data = await searchAdminStudents(searchParams);
      setResults(data || []);
    } catch (e) {
      setError('Lỗi khi tìm kiếm: ' + e.message);
      setResults([]);
    }
    setLoading(false);
  }, [searchParams]); // Bỏ term trong dependency vì term không thay đổi khi search

  const handleModalClose = (didSave) => {
    setSelectedStudent(null);
  };

  return (
    <>
      {/* Tiêu đề trang */}
      <div className='section-title mb-3'>
        <i className='bi bi-binoculars me-2'></i>
        Tìm kiếm Sinh viên – Kỳ <b>{term}</b>
      </div>

      {/* Form tìm kiếm */}
      <Card className="mb-3">
        <Card.Body>
          <Form onSubmit={handleSearch}>
            <Row className="g-2 align-items-end">
              {/* Input MSSV */}
              <Col md={3}>
                <Form.Group>
                  <Form.Label size="sm">MSSV</Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    name="studentCode"
                    value={searchParams.studentCode}
                    onChange={handleInputChange}
                    placeholder="Nhập MSSV..."
                  />
                </Form.Group>
              </Col>
              {/* Input Họ Tên */}
              <Col md={4}>
                <Form.Group>
                  <Form.Label size="sm">Họ Tên</Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    name="name"
                    value={searchParams.name}
                    onChange={handleInputChange}
                    placeholder="Nhập họ tên..."
                  />
                </Form.Group>
              </Col>
              {/* Input Mã Lớp */}
              <Col md={3}>
                <Form.Group>
                  <Form.Label size="sm">Mã Lớp</Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    name="classCode"
                    value={searchParams.classCode}
                    onChange={handleInputChange}
                    placeholder="Nhập mã lớp..."
                  />
                </Form.Group>
              </Col>
              {/* Nút Tìm */}
              <Col md={2}>
                <Button type="submit" size="sm" variant='success' className="w-100 btn-main" disabled={loading}>
                  {loading ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="bi bi-search me-1"></i>}
                  Tìm
                </Button>
              </Col>
            </Row>
          </Form>
          {/* Hiển thị lỗi tìm kiếm (nếu có) */}
          {error && <div className="text-danger mt-2 small">{error}</div>}
        </Card.Body>
      </Card>

      {/* Hiển thị loading khi đang tìm */}
      {loading && <LoadingSpinner />}

      {/* Hiển thị kết quả sau khi tìm xong */}
      {results && !loading && (
        <Card className="mt-3">
          <Card.Body>
            <h5>Kết quả tìm kiếm ({results.length})</h5>
            {results.length === 0 ? (
              <Alert variant="warning" className="mb-0">Không tìm thấy sinh viên nào phù hợp.</Alert>
            ) : (
              <Table striped responsive size="sm" className="align-middle mb-0">
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
                        <Button
                          size="sm"
                          variant="outline-success"
                          onClick={() => handleShow(s.student_code,s.full_name) }
                        >
                          Xem
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Render Modal xem/sửa điểm khi selectedStudent có giá trị */}
      <Modal show={show} size='lg' scrollable={true} onHide={handleClose}>
        <Modal.Header closeButton>
        </Modal.Header>
        <Modal.Body>
          {selectedStudent && (
            <StudentSearchDetails
              user={{ student_code: selectedStudent.code }}
            />
          )}
        </Modal.Body>
      </Modal>

    </>
  );
};

export default SearchStudentsPage;