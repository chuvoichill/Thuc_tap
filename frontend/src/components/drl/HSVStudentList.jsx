import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Alert, Badge } from 'react-bootstrap';
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

  // ✅ Optimistic update - Cập nhật state local thay vì refetch
  const handleStudentUpdate = useCallback((studentCode, criterionCode, updatedData) => {
    setStudents(prev => prev.map(s => {
      if (s.student_code === studentCode && s.criterion_code === criterionCode) {
        return { ...s, ...updatedData };
      }
      return s;
    }));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ✅ Group students by student_code (mỗi sinh viên hiển thị 1 lần)
  const groupedStudents = useMemo(() => {
    const groups = {};
    students.forEach(s => {
      if (!s.student_code) return;
      
      if (!groups[s.student_code]) {
        groups[s.student_code] = {
          student_code: s.student_code,
          full_name: s.full_name,
          criteria: []
        };
      }
      
      // Thêm tiêu chí vào danh sách
      if (s.criterion_code) {
        groups[s.student_code].criteria.push(s);
      }
    });
    
    return Object.values(groups);
  }, [students]);

  // Lấy thông tin tiêu chí
  const criteriaInfo = useMemo(() => {
    const uniqueCriteria = [];
    const seen = new Set();
    
    students.forEach(s => {
      if (s.criterion_code && !seen.has(s.criterion_code)) {
        seen.add(s.criterion_code);
        uniqueCriteria.push({
          code: s.criterion_code,
          title: s.criterion_title,
          type: s.criterion_type,
          max_points: s.max_points
        });
      }
    });
    
    return uniqueCriteria;
  }, [students]);

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <Alert variant="danger">Lỗi tải danh sách sinh viên: {error}</Alert>;
    if (groupedStudents.length === 0) return <Alert variant="info">Không có sinh viên trong lớp này.</Alert>;

    return (
      <div>
        {/* Hiển thị danh sách tiêu chí */}
        {criteriaInfo.length > 0 && (
          <Alert variant="info" className="mb-3">
            <strong>📝 Tiêu chí cần xác nhận:</strong>
            <ul className="mb-0 mt-2">
              {criteriaInfo.map(c => (
                <li key={c.code}>
                  <Badge bg="primary" className="me-2">{c.code}</Badge>
                  {c.title} 
                  <span className="text-muted ms-2">(Điểm tối đa: {c.max_points})</span>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Hiển thị từng sinh viên */}
        {groupedStudents.map(student => (
          <Card key={student.student_code} className="shadow-sm mb-3">
            <Card.Header className="bg-light d-flex justify-content-between align-items-center">
              <div>
                <strong className="text-primary">{student.student_code}</strong>
                <span className="ms-3">{student.full_name}</span>
              </div>
              <Badge bg={student.criteria.every(c => c.is_hsv_verified) ? 'success' : 'warning'}>
                {student.criteria.filter(c => c.is_hsv_verified).length}/{student.criteria.length} đã xác nhận
              </Badge>
            </Card.Header>
            <Card.Body className="p-0">
              <Table className="mb-0" hover size="sm">
                <thead className="table-light">
                  <tr>
                    <th style={{width: '200px'}}>Tiêu chí</th>
                    <th style={{width: '80px'}} className="text-center">Điểm</th>
                    <th className="text-center">Nội dung SV</th>
                    <th style={{width: '200px'}} className="text-center">Xác nhận</th>
                    <th style={{width: '200px'}} className="text-center">Ghi chú HSV</th>
                    <th style={{width: '180px'}} className="text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {student.criteria.map((criterion, idx) => (
                    <HSVStudentRow
                      key={`${student.student_code}-${criterion.criterion_code}-${idx}`}
                      student={criterion}
                      term={term}
                      onUpdate={handleStudentUpdate}
                    />
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <Card.Header className="bg-success text-white">
        <h5 className="mb-0">
          <i className="bi bi-people-fill me-2"></i>
          Lớp <strong>{classCode}</strong> - Xác nhận HSV
        </h5>
      </Card.Header>
      <Card.Body>
        {renderContent()}
      </Card.Body>
    </Card>
  );
};

export default HSVStudentList;