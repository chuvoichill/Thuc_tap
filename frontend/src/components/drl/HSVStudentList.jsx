import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Alert, Badge, Button, Pagination, ButtonGroup, Spinner } from 'react-bootstrap';
import { getHSVClassStudents, confirmHSVAssessment } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import HSVStudentRow from './HSVStudentRow';
import useAuth from '../../hooks/useAuth';
import useNotify from '../../hooks/useNotify'; 

// ✅ Constants
const BATCH_NOTES = {
  PARTICIPATED: 'em đã tham gia!',
  NOT_PARTICIPATED: 'em chưa tham gia!'
};

const HSVStudentList = ({ classCode, term }) => {
  const { user } = useAuth();
  const { notify } = useNotify();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Filter tabs: 'all', 'submitted', 'not-submitted'
  const [activeTab, setActiveTab] = useState('all');
  
  // Batch operation state
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchSnapshot, setBatchSnapshot] = useState(null); // For undo

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

  // ✅ Filter students based on active tab
  const filteredStudents = useMemo(() => {
    if (activeTab === 'all') return groupedStudents;
    
    return groupedStudents.filter(student => {
      const hasSubmitted = student.criteria.some(c => 
        (c.text_value && c.text_value.trim() !== '') || c.option_id != null
      );
      
      if (activeTab === 'submitted') return hasSubmitted;
      if (activeTab === 'not-submitted') return !hasSubmitted;
      return true;
    });
  }, [groupedStudents, activeTab]);

  // ✅ Pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // ✅ Batch confirm all (for submitted students)
  const handleConfirmAll = async () => {
    // Calculate how many students have actually submitted (TOÀN BỘ, không chỉ trang hiện tại)
    const submittedStudents = filteredStudents.filter(student => 
      student.criteria.some(c => 
        (c.text_value && c.text_value.trim() !== '') || c.option_id != null
      )
    );
    
    if (submittedStudents.length === 0) {
      notify('Không có sinh viên nào đã nộp thông tin!', 'warning');
      return;
    }
    
    // Đếm tổng số tiêu chí sẽ xử lý
    const totalCriteria = submittedStudents.reduce((sum, s) => 
      sum + s.criteria.filter(c => (c.text_value && c.text_value.trim() !== '') || c.option_id != null).length, 0
    );
    
    if (!window.confirm(`Bạn có chắc muốn xác nhận TẤT CẢ ${submittedStudents.length} sinh viên đã nhập thông tin (${totalCriteria} tiêu chí)?`)) return;
    
    setIsBatchProcessing(true);
    setBatchSnapshot([...students]); // Save snapshot for undo
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const student of submittedStudents) {
        for (const criterion of student.criteria) {
          try {
            // Only confirm students who have actually submitted
            const hasSubmitted = (criterion.text_value && criterion.text_value.trim() !== '') || criterion.option_id != null;
            
            if (!hasSubmitted) {
              continue; // Skip students who haven't submitted
            }
            
            const autoNote = BATCH_NOTES.PARTICIPATED;
            
            await confirmHSVAssessment(
              student.student_code,
              term,
              criterion.criterion_code,
              true, // participated = true for submitted students
              autoNote,
              user.username
            );
            
            successCount++;
          } catch (e) {
            console.error(`Error confirming ${student.student_code} - ${criterion.criterion_code}:`, e);
            errorCount++;
          }
        }
      }
      
      // ✅ Reload data from server to get actual state after batch operation
      await fetchData();
      
      if (errorCount > 0) {
        notify(`Xác nhận thành công ${submittedStudents.length} sinh viên (${successCount}/${totalCriteria} tiêu chí, ${errorCount} lỗi)`, 'warning');
      } else {
        notify(`Đã xác nhận thành công ${submittedStudents.length} sinh viên (${successCount} tiêu chí)`, 'success');
      }
    } catch (e) {
      notify('Có lỗi xảy ra: ' + e.message, 'danger');
    }
    
    setIsBatchProcessing(false);
  };

  // ✅ Batch give 0 points (for not-submitted students)
  const handleGiveAllZero = async () => {
    // Calculate how many students haven't submitted (TOÀN BỘ, không chỉ trang hiện tại)
    const notSubmittedStudents = filteredStudents.filter(student => 
      student.criteria.every(c => 
        (!c.text_value || c.text_value.trim() === '') && c.option_id == null
      )
    );
    
    if (notSubmittedStudents.length === 0) {
      notify('Không có sinh viên nào CHƯA NỘP thông tin!', 'warning');
      return;
    }
    
    // Đếm tổng số tiêu chí sẽ xử lý
    const totalCriteria = notSubmittedStudents.reduce((sum, s) => sum + s.criteria.length, 0);
    
    if (!window.confirm(`Bạn có chắc muốn cho TẤT CẢ ${notSubmittedStudents.length} sinh viên chưa nhập thông tin 0 điểm (${totalCriteria} tiêu chí)?`)) return;
    
    setIsBatchProcessing(true);
    setBatchSnapshot([...students]); // Save snapshot for undo
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const student of notSubmittedStudents) {
        for (const criterion of student.criteria) {
          try {
            // Only give zero to students who haven't submitted
            const hasSubmitted = (criterion.text_value && criterion.text_value.trim() !== '') || criterion.option_id != null;
            
            if (hasSubmitted) {
              continue; // Skip students who have submitted
            }
            
            const autoNote = BATCH_NOTES.NOT_PARTICIPATED;
            
            await confirmHSVAssessment(
              student.student_code,
              term,
              criterion.criterion_code,
              false, // participated = false → 0 points
              autoNote,
              user.username
            );
            
            successCount++;
          } catch (e) {
            console.error(`Error giving zero to ${student.student_code} - ${criterion.criterion_code}:`, e);
            errorCount++;
          }
        }
      }
      
      // ✅ Reload data from server to get actual state after batch operation
      await fetchData();
      
      if (errorCount > 0) {
        notify(`Xử lý thành công ${notSubmittedStudents.length} sinh viên (${successCount}/${totalCriteria} tiêu chí, ${errorCount} lỗi)`, 'warning');
      } else {
        notify(`Đã xử lý thành công ${notSubmittedStudents.length} sinh viên (${successCount} tiêu chí)!`, 'success');
      }
    } catch (e) {
      notify('Có lỗi xảy ra: ' + e.message, 'danger');
    }
    
    setIsBatchProcessing(false);
  };

  // ✅ Undo batch operation - revert all changes in backend
  const handleUndoBatch = async () => {
    if (!batchSnapshot) return;
    if (!window.confirm('Bạn có chắc muốn hoàn tác thao tác hàng loạt vừa rồi?')) return;
    
    setIsBatchProcessing(true);
    
    try {
      // Revert all confirmations by setting participated=false and empty note
      let successCount = 0;
      let errorCount = 0;
      
      // Hoàn tác TẤT CẢ sinh viên trong filteredStudents (không chỉ trang hiện tại)
      for (const student of filteredStudents) {
        for (const criterion of student.criteria) {
          try {
            await confirmHSVAssessment(
              criterion.student_code,
              term,
              criterion.criterion_code,
              false, // participated = false to unverify
              '', // Empty note
              user.username
            );
            successCount++;
          } catch (e) {
            console.error(`Error reverting ${criterion.student_code} - ${criterion.criterion_code}:`, e);
            errorCount++;
          }
        }
      }
      
      // Reload data from server
      await fetchData();
      setBatchSnapshot(null);
      
      if (errorCount > 0) {
        notify(`Đã hoàn tác ${successCount} xác nhận (${errorCount} lỗi)`, 'warning');
      } else {
        notify(`Đã hoàn tác ${successCount} xác nhận`, 'info');
      }
    } catch (e) {
      notify('Có lỗi khi hoàn tác: ' + e.message, 'danger');
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
        {/* Hiển thị danh sách tiêu chí */}
        {criteriaInfo.length > 0 && (
          <Alert variant="light" className="mb-3 border">
            <div className="d-flex align-items-start">
              <i className="bi bi-info-circle-fill text-info me-2 mt-1"></i>
              <div className="flex-grow-1">
                <strong className="text-dark">Tiêu chí cần xác nhận:</strong>
                <div className="mt-2">
                  {criteriaInfo.map(c => (
                    <div key={c.code} className="mb-1">
                      <Badge bg="primary" className="me-2">{c.code}</Badge>
                      <span className="text-dark">{c.title}</span>
                      <span className="text-muted ms-2 small">(Điểm tối đa: {c.max_points})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Alert>
        )}

        {/* Tab filters and batch actions */}
        <Card className="mb-3 shadow-sm">
          <Card.Body className="py-3">
            <div className="d-flex justify-content-between align-items-center">
              <ButtonGroup>
                <Button 
                  variant={activeTab === 'all' ? 'success' : 'outline-success'}
                  onClick={() => setActiveTab('all')}
                  className="px-3"
                >
                  Tất cả <Badge bg={activeTab === 'all' ? 'light' : 'success'} text={activeTab === 'all' ? 'dark' : 'white'} className="ms-1">{groupedStudents.length}</Badge>
                </Button>
                <Button 
                  variant={activeTab === 'submitted' ? 'success' : 'outline-success'}
                  onClick={() => setActiveTab('submitted')}
                  className="px-3"
                >
                  Đã tự đánh giá <Badge bg={activeTab === 'submitted' ? 'light' : 'success'} text={activeTab === 'submitted' ? 'dark' : 'white'} className="ms-1">{groupedStudents.filter(s => s.criteria.some(c => (c.text_value && c.text_value.trim() !== '') || c.option_id != null)).length}</Badge>
                </Button>
                <Button 
                  variant={activeTab === 'not-submitted' ? 'danger' : 'outline-danger'}
                  onClick={() => setActiveTab('not-submitted')}
                  className="px-3"
                >
                  Chưa đánh giá <Badge bg={activeTab === 'not-submitted' ? 'light' : 'danger'} text={activeTab === 'not-submitted' ? 'dark' : 'white'} className="ms-1">{groupedStudents.filter(s => !s.criteria.some(c => (c.text_value && c.text_value.trim() !== '') || c.option_id != null)).length}</Badge>
                </Button>
              </ButtonGroup>

              {/* Batch action buttons - fixed position to prevent layout shift */}
              <div className="d-flex gap-2" style={{minWidth: '200px', justifyContent: 'flex-end'}}>
                {batchSnapshot && (
                  <Button variant="warning" onClick={handleUndoBatch} size="sm">
                    <i className="bi bi-arrow-counterclockwise me-1"></i>
                    Hoàn tác
                  </Button>
                )}
                
                {activeTab === 'submitted' && paginatedStudents.length > 0 && (
                  <Button 
                    variant="success" 
                    onClick={handleConfirmAll}
                    disabled={isBatchProcessing}
                    size="sm"
                  >
                    {isBatchProcessing ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-1" />
                        Xử lý...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-all me-1"></i>
                        Xác nhận tất cả
                      </>
                    )}
                  </Button>
                )}
                
                {activeTab === 'not-submitted' && paginatedStudents.length > 0 && (
                  <Button 
                    variant="danger" 
                    onClick={handleGiveAllZero}
                    disabled={isBatchProcessing}
                    size="sm"
                  >
                    {isBatchProcessing ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-1" />
                        Xử lý...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle me-1"></i>
                        Cho tất cả 0đ
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* No results message */}
        {filteredStudents.length === 0 && (
          <Alert variant="warning" className="text-center">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Không có sinh viên nào trong danh sách {activeTab === 'submitted' ? 'đã đánh giá' : activeTab === 'not-submitted' ? 'chưa đánh giá' : ''}.
          </Alert>
        )}

        {/* Student list container with min-height to prevent jumping */}
        <div style={{minHeight: '400px'}}>
          {/* Hiển thị từng sinh viên */}
          {paginatedStudents.map((student, index) => (
            <Card key={student.student_code} className="shadow-sm mb-3">
              <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                <div>
                  <strong className="text-primary">{student.student_code}</strong>
                  <span className="ms-3 text-dark fw-semibold">{student.full_name}</span>
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

        {/* Pagination - centered with fixed container */}
        <div className="d-flex justify-content-center mt-4" style={{minHeight: '60px'}}>
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

          {totalPages === 1 && filteredStudents.length > 0 && (
            <div className="text-center text-muted small">
              <i className="bi bi-info-circle me-1"></i>
              Tổng cộng {filteredStudents.length} sinh viên
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="border-0 shadow">
      <Card.Header className="bg-success text-white py-3">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 d-flex align-items-center">
            <i className="bi bi-people-fill me-2"></i>
            Lớp <strong className="mx-2">{classCode}</strong> - Xác nhận HSV
          </h5>
          {!loading && groupedStudents.length > 0 && (
            <Badge bg="light" text="dark" className="px-3 py-2" style={{fontSize: '0.9rem'}}>
              <i className="bi bi-person-check me-1"></i>
              {groupedStudents.filter(s => s.criteria.every(c => c.is_hsv_verified)).length} / {groupedStudents.length} hoàn thành
            </Badge>
          )}
        </div>
      </Card.Header>
      <Card.Body className="p-4">
        {renderContent()}
      </Card.Body>
    </Card>
  );
};

export default HSVStudentList;