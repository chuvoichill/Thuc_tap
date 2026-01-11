// frontend/src/components/drl/FacultyClassList.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Table, Alert, Button, Modal, Form } from 'react-bootstrap'; // Import components
import { useTerm } from '../../layout/DashboardLayout';
import useAuth from '../../hooks/useAuth';
import { getFacultyStudents, approveFacultyClass } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import StudentAssessmentModal from './StudentAssessmentModal';
import useNotify from '../../hooks/useNotify';
import axios from 'axios';
const FacultyClassList = ({ facultyCode, setFaculty }) => {
  const { term } = useTerm();
  const { user } = useAuth();
  const { notify } = useNotify();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

  const fetchData = useCallback(async () => {
    if (!term || !user?.role) return;
    setLoading(true);
    setError(null);
    setSelectedStudent(null);
    try {
      let res;
      if (user.role === 'faculty') {
        res = await getFacultyStudents(term);
        if (setFaculty) setFaculty(user.faculty_code || null);
      } else {
        setClasses([]);
        return;
      }
      const data = res?.data ?? res ?? [];
      setClasses(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Fetch error');
    } finally {
      setLoading(false);
    }
  }, [term, user?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tối ưu: Sử dụng useMemo thay vì useEffect + useState để tránh render thừa
  const lockedClasses = useMemo(() => {
    const lockStatus = {};
    if (user?.role === 'faculty' && classes.length > 0) {
      classes.forEach(c => {
        if (c.class_name) lockStatus[c.class_name] = c.is_faculty_approved;
      });
    }
    return lockStatus;
  }, [user?.role, classes]);

  const handleModalClose = () => {
    setSelectedStudent(null);
    fetchData(); // Cập nhật lại danh sách sau khi đóng modal
  };

  const handleApproveAll = async () => {
    // Lấy danh sách lớp duy nhất từ danh sách sinh viên
    // Chỉ lấy các lớp chưa được duyệt (chưa bị khóa)
    const uniqueClasses = [...new Set(classes.map(c => c.class_name))].filter(name => !lockedClasses[name]);
    
    if (uniqueClasses.length === 0) {
      notify('Tất cả các lớp đã được duyệt!', 'info');
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn duyệt tất cả ${uniqueClasses.length} lớp?\n\n` +
      'Sau khi duyệt, bạn sẽ không thể chỉnh sửa hoặc duyệt lại được nữa.'
    );
    
    if (!confirmed) return;

    setLoading(true);
    let successCount = 0;
    let errorMessages = [];

    // Tối ưu: Chạy song song tất cả request thay vì tuần tự
    const promises = uniqueClasses.map(className => 
      approveFacultyClass(className, term)
        .then(() => ({ status: 'fulfilled', className }))
        .catch(err => ({ status: 'rejected', className, error: err }))
    );

    const results = await Promise.all(promises);

    results.forEach(res => {
      if (res.status === 'fulfilled') {
        successCount++;
      } else {
        const errorMsg = res.error.response?.data?.error || res.error.message;
        errorMessages.push(`${res.className}: ${errorMsg}`);
      }
    });

    setLoading(false);

    if (successCount > 0) {
      notify(`Đã duyệt thành công ${successCount}/${uniqueClasses.length} lớp!`, 'success');
      fetchData(); // Tải lại danh sách
    }

    if (errorMessages.length > 0) {
      notify('Một số lớp không thể duyệt: ' + errorMessages.join(', '), 'warning');
    }
  };

  const filteredClasses = classes.filter(c => {
    const matchesStudentCode = (c.student_code || '').toLowerCase().includes(studentCode.toLowerCase());
    const matchesFullName = (c.full_name || '').toLowerCase().includes(fullName.toLowerCase());
    const matchesClassCode = (c.class_name || '').toLowerCase().includes(classCode.toLowerCase());
    return matchesStudentCode && matchesFullName && matchesClassCode;
  });

  const previewTemplate = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/drl/excel-preview?term_code=${encodeURIComponent(term)}&faculty_code=${encodeURIComponent(user.role === "faculty" ? user.faculty_code : facultyCode)}`,
        {
          withCredentials: true,
          headers: {
            // Sử dụng localStorage để đảm bảo lấy đúng token nếu user object không chứa token
            Authorization: `Bearer ${JSON.parse(localStorage.getItem("auth"))?.token || ""}`
          }
        }
      );

      setPreview(res.data);  // Lưu JSON preview
      setIsPreviewOpen(true); // Mở modal preview
    } catch (err) {
      console.error("Lỗi preview:", err);
      if (err.response?.status === 404) {
        notify("Chưa có dữ liệu đánh giá cho kỳ học này.", 'warning');
      } else {
        notify("Không thể xem trước file. Lỗi: " + (err.message || "Unknown error"), 'danger');
      }
    }
  };

  const downloadTemplate = async () => {
    try {
      // 1. Dùng axios gốc và Tắt responseType mặc định
      const res = await axios.get(
        `${API_BASE}/api/drl/excel-template?term_code=${encodeURIComponent(term)}&faculty_code=${encodeURIComponent(user.role === "faculty" ? user.faculty_code : facultyCode)}`,
        {
          responseType: 'blob', // BẮT BUỘC: Nhận data dưới dạng Blob
          withCredentials: true,
          // Thêm token vào header thủ công (vì không dùng interceptor của 'api')
          headers: {
            'Authorization': `Bearer ${JSON.parse(localStorage.getItem('auth'))?.token || ''}`
          }
        }
      );

      // 2. Khi dùng Axios, dữ liệu Blob nằm trong res.data
      const blob = res.data;

      // 3. Kiểm tra lỗi response code
      if (res.status !== 200) {
        throw new Error(`Tải file thất bại. Status: ${res.status}`);
      }
      // 4. Tạo URL tạm thời và kích hoạt tải xuống
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      // Đặt tên file chính xác hơn
      a.download = "bao_cao_template.xlsx";

      document.body.appendChild(a); // Nên thêm vào body trước khi click để đảm bảo hoạt động trên mọi trình duyệt
      a.click();

      document.body.removeChild(a); // Dọn dẹp thẻ <a>
      window.URL.revokeObjectURL(url); // Giải phóng URL tạm thời

    } catch (error) {
      // Ghi log lỗi chi tiết hơn
      console.error("Lỗi tải:", error.message || error);
      // Có thể thêm thông báo cho người dùng ở đây
      notify(error.message || "Đã xảy ra lỗi trong quá trình tải file.", 'danger');
    }
  };

  return (
    <>
      {/* Dùng Card thay cho div.card */}
      <Card>

        <Card.Body>
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            // Dùng Alert variant="danger"
            <Alert variant="danger">Lỗi: {error}</Alert>
          ) : !classes.length ? (
            // Dùng Alert variant="info"
            <Alert variant="info">Không có lớp.</Alert>
          ) : (
            // Dùng Table responsive thay cho div.table-responsive
            <Table striped responsive className="align-middle">
              <thead>
                <tr>
                  <th style={{ borderBottom: "none" }}>MSV</th>
                  <th style={{ borderBottom: "none" }}>Họ Tên</th>
                  <th style={{ borderBottom: "none" }}>Lớp</th>
                  <th className="text-center" style={{ borderBottom: "none" }}>Tổng điểm (gv)</th>
                  <th className="text-center" style={{ borderBottom: "none" }}>Tổng điểm (khoa)</th>
                  <th style={{ borderBottom: "none" }}></th>
                  <th style={{ borderBottom: "none" }}></th>
                </tr>
                <tr>
                  <th><Form.Control name="studentCode" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} size='sm'></Form.Control></th>
                  <th><Form.Control name="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} size='sm'></Form.Control></th>
                  <th><Form.Control name="classCode" value={classCode} onChange={(e) => setClassCode(e.target.value)} size='sm'></Form.Control></th>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((c) => (
                  <tr key={c.student_code}>
                    <td>{c.student_code}</td>
                    <td>{c.full_name}</td>
                    <td>{c.class_name}</td>
                    <td className='text-center'>{c.teacher_score || 0}</td>
                    <td className='text-center'>{c.faculty_score || c.teacher_score || 0}</td>
                    <td className="text-end">
                      <Button
                        size="sm"
                        variant='success'
                        className="btn-main"
                        onClick={() => setSelectedStudent({ code: c.student_code, className: c.class_name, note: c.note })}
                      >
                        {user?.role === 'faculty' && lockedClasses[c.class_name] ? 'Xem' : 'Xem/Sửa'}
                      </Button>
                    </td>
                    <td className="text-end">
                      {/* Dùng Button variant="outline-primary" size="sm" */}

                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      <div className="d-flex mt-3" style={{ justifyContent: "space-between" }}>
        <Button onClick={previewTemplate} variant="outline-success" className="mt-3">
          <i className="fa-regular fa-file-excel m-2"></i>
          Xuất Excel
        </Button>

        {user?.role === 'faculty' && (
          <Button
            size="sm"
            variant='success'
            className="btn-main mt-3"
            onClick={handleApproveAll}
            disabled={loading || classes.length === 0 || Object.values(lockedClasses).every(locked => locked)}
          >
            Duyệt tất cả
          </Button>
        )}
      </div>

      {selectedStudent && (
        <StudentAssessmentModal
          studentCode={selectedStudent.code}
          noted={selectedStudent.note}
          term={term}
          onClose={handleModalClose}
          page="faculty"
          role="faculty"
          isLocked={user?.role === 'faculty' && lockedClasses[selectedStudent.className]}
        />
      )}
      <Modal show={isPreviewOpen} onHide={() => setIsPreviewOpen(false)} size="xl" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Bản xem trước</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {!preview ? (
            <p>Đang tải...</p>
          ) : (
            <>
              <h5 className="mb-3">
                {preview.title}
              </h5>
              <p><b>Khoa:</b> {preview.faculty}</p>

              <Table striped bordered hover size="sm" responsive>
                <thead>
                  <tr>
                    {preview.columns.map((col, idx) => (
                      <th key={idx}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.tt}</td>
                      <td>{row.student_code}</td>
                      <td>{row.full_name}</td>
                      <td>{row.class_code}</td>
                      <td>{row.faculty}</td>
                      <td>{row.total_score}</td>
                      <td>{row.rank}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="success" onClick={downloadTemplate}>
            Tải file Excel
          </Button>
        </Modal.Footer>
      </Modal>

    </>
  );
}
export default FacultyClassList;