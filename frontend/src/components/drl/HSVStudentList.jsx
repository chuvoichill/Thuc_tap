import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Alert, Badge, Button, Pagination, ButtonGroup, Spinner } from 'react-bootstrap';
import { getHSVClassStudents, confirmHSVAssessment } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import HSVStudentRow from './HSVStudentRow';
import useAuth from '../../hooks/useAuth';
import useNotify from '../../hooks/useNotify';

// ✅ Helper: Kiểm tra sinh viên đã submit
const hasStudentSubmitted = (criterion) => {
  return (criterion.text_value && criterion.text_value.trim() !== '') || 
         (criterion.option_id != null && criterion.score != 0);
};

const HSVStudentList = ({ classCode, term, showHeader = true }) => {
  const { user } = useAuth();
  const { notify } = useNotify();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter: true = có nội dung cần xem xét, false = không có nội dung
  const [needsReview, setNeedsReview] = useState(true);

  // Batch operation state
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

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

  // ✅ Filter students based on needsReview
  const filteredStudents = useMemo(() => {
    return groupedStudents.filter(student => {
      const hasSubmitted = student.criteria.some(c => hasStudentSubmitted(c));
      return needsReview ? hasSubmitted : !hasSubmitted;
    });
  }, [groupedStudents, needsReview]);

  // ✅ Pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [needsReview]);

  // ✅ Xác nhận tất cả sinh viên không có nội dung
  const handleConfirmAllNotSubmitted = async () => {
    if (filteredStudents.length === 0) {
      notify('Không có sinh viên nào cần xác nhận!', 'warning');
      return;
    }

    const totalCriteria = filteredStudents.reduce((sum, s) => sum + s.criteria.length, 0);
    
    if (!window.confirm(`Bạn có chắc muốn xác nhận TẤT CẢ ${filteredStudents.length} sinh viên (${totalCriteria} tiêu chí)?\nLưu ý: Điểm sẽ được giữ nguyên (0 điểm).`)) return;

    setIsBatchProcessing(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const student of filteredStudents) {
        for (const criterion of student.criteria) {
          try {
            await confirmHSVAssessment(
              student.student_code,
              term,
              criterion.criterion_code,
              true, // Chỉ xác nhận, không thay đổi điểm
              'em chưa tham gia!',
              user.username
            );
            successCount++;
          } catch (e) {
            console.error(`Error confirming ${student.student_code} - ${criterion.criterion_code}:`, e);
            errorCount++;
          }
        }
      }

      await fetchData();

      if (errorCount > 0) {
        notify(`Xác nhận thành công ${filteredStudents.length} sinh viên (${successCount}/${totalCriteria} tiêu chí, ${errorCount} lỗi)`, 'warning');
      } else {
        notify(`Đã xác nhận thành công ${filteredStudents.length} sinh viên (${successCount} tiêu chí)`, 'success');
      }
    } catch (e) {
      notify('Có lỗi xảy ra: ' + e.message, 'danger');
    }

    setIsBatchProcessing(false);
  };

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
        

        {/* Tab filters and batch actions */}
        <Card className="mb-3 sm">
          <Card.Body className="py-3">
            <div className="d-flex justify-content-between align-items-center">
              <ButtonGroup>
                <Button
                  variant={needsReview ? 'success' : 'outline-success'}
                  onClick={() => setNeedsReview(true)}
                  className="px-3"
                >
                  Có nội dung cần xem xét <Badge bg={needsReview ? 'light' : 'success'} text={needsReview ? 'dark' : 'white'} className="ms-1">{groupedStudents.filter(s => s.criteria.some(hasStudentSubmitted)).length}</Badge>
                </Button>
                <Button
                  variant={!needsReview ? 'success' : 'outline-success'}
                  onClick={() => setNeedsReview(false)}
                  className="px-3"
                >
                  Không có nội dung <Badge bg={!needsReview ? 'light' : 'success'} text={!needsReview ? 'dark' : 'white'} className="ms-1">{groupedStudents.filter(s => !s.criteria.some(hasStudentSubmitted)).length}</Badge>
                </Button>
              </ButtonGroup>

              {/* Batch action button for not-submitted students */}
              {!needsReview && filteredStudents.length > 0 && (
                <Button
                  variant="success"
                  onClick={handleConfirmAllNotSubmitted}
                  disabled={isBatchProcessing}
                  size="sm"
                >
                  {isBatchProcessing ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-1" />
                      Đang xác nhận...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-all me-1"></i>
                      Xác nhận tất cả
                    </>
                  )}
                </Button>
              )}
            </div>
          </Card.Body>
        </Card>

        {/* No results message */}
        {filteredStudents.length === 0 && (
          <Alert variant="warning" className="text-center">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Không có sinh viên nào trong danh sách {needsReview ? 'đã đánh giá' : 'chưa đánh giá'}.
          </Alert>
        )}

        {/* Student list container with min-height to prevent jumping */}
        <div style={{ minHeight: '400px' }}>
          {/* Hiển thị từng sinh viên */}
          {paginatedStudents.map((student) => (
            <Card key={student.student_code} className="sm mb-3">
              <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                <div>
                  <strong className="text-dark">{student.student_code}</strong>
                  <span className="ms-3 text-dark fw-semibold">{student.full_name}</span>
                </div>
              </Card.Header>
              <Card.Body className="p-0">
                <Table className="mb-0" hover size="sm">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '200px' }}>Tiêu chí</th>
                      <th style={{ width: '80px' }} className="text-center">Điểm</th>
                      <th className="text-center">Nội dung SV</th>
                      <th style={{ width: '200px' }} className="text-center">Đúng</th>
                      <th style={{ width: '200px' }} className="text-center">Ghi chú HSV</th>
                      <th style={{ width: '180px' }} className="text-center">Thao tác</th>
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

        {/* Pagination - centered with fixed container */}
        <div className="d-flex justify-content-center mt-4" style={{ minHeight: '60px' }}>
          {totalPages > 1 && (
            <div className="d-flex flex-column align-items-center gap-2">
              <Pagination className="mb-0">
                <Pagination.First onClick={() => setCurrentPage(1)} disabled={currentPage === 1} />
                <Pagination.Prev onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} />

                {[...Array(totalPages)].map((_, idx) => {
                  const page = idx + 1;
                  if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
                    return (
                      <Pagination.Item
                        key={page}
                        active={page === currentPage}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Pagination.Item>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <Pagination.Ellipsis key={page} disabled />;
                  }
                  return null;
                })}

                <Pagination.Next onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} />
                <Pagination.Last onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} />
              </Pagination>

              <div className="text-muted small">
                <i className="bi bi-info-circle me-1"></i>
                Hiển thị {Math.min(filteredStudents.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(filteredStudents.length, currentPage * itemsPerPage)} / {filteredStudents.length} sinh viên
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {showHeader && (
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
          <h5 className="mb-0">
            <i className="bi bi-people-fill me-2 text-success"></i>
            Lớp <strong>{classCode}</strong> - Xác nhận HSV
          </h5>
          {!loading && groupedStudents.length > 0 && (
            <Badge bg="success" className="px-3 py-2" style={{ fontSize: '0.9rem' }}>
              <i className="bi bi-person-check me-1"></i>
              {groupedStudents.filter(s => s.criteria.every(c => c.is_hsv_verified)).length} / {groupedStudents.length} hoàn thành
            </Badge>
          )}
        </div>
      )}
      {renderContent()}
    </>
  );
};

export default HSVStudentList;