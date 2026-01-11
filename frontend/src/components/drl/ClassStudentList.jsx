import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Alert, Button, Form, Modal } from 'react-bootstrap';
import { getAdminClassStudents, getFacultyClassStudents, getTeacherStudents, postAccept, getTeacherLockStatus } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import StudentAssessmentModal from './StudentAssessmentModal';
import useAuth from '../../hooks/useAuth';
import axios from 'axios';
import useNotify from '../../hooks/useNotify';


const ClassStudentList = ({ classCode, term, onListLoaded, setClassCode, onStudentsLoaded, page }) => {
  const { user } = useAuth();
  const { notify } = useNotify();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formData, setFormData] = useState({ msv: '', name: '' });
  const [isLocked, setIsLocked] = useState(false);
  const [preview, setPreview] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let res;
      if (user?.role === 'faculty') {
        if (!classCode || !term) return console.log("thiếu dữ liệu!");
        else res = await getFacultyClassStudents(classCode, term);
      }

      else if (user?.role === 'admin') {
        if (!classCode || !term) return console.log("thiếu dữ liệu!");
        else res = await getAdminClassStudents(classCode, term);
      }

      else if (user?.role === 'teacher') {
        if (!term) return console.log("thiếu dữ liệu!");
        res = await getTeacherStudents(user.username, term);
        setClassCode(res[0]?.class_code || null);
      }

      const data = res.data || res;

      setStudents(data);
      if (onListLoaded) onListLoaded();
      if (onStudentsLoaded) onStudentsLoaded(data); // Truyền danh sách sinh viên lên parent
    } catch (e) {
      console.error('lỗi ko load được sinh viên:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }

  }, [classCode, term, user?.role, user?.username, onListLoaded, onStudentsLoaded]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Kiểm tra trạng thái khóa nếu là giáo viên
    const checkLockStatus = async () => {
      if (user?.role === 'teacher' && term) {
        try {
          const response = await getTeacherLockStatus(term);
          setIsLocked(response?.data?.isLocked || response?.isLocked || false);
        } catch (error) {
          console.error('Lỗi khi kiểm tra trạng thái khóa:', error);
          setIsLocked(false);
        }
      }
    };
    checkLockStatus();
  }, [user?.role, term]);

  const handleApprove = async () => {
    if (isLocked) {
      notify('Bạn đã duyệt rồi, không thể duyệt lại!', 'warning');
      return;
    }

    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn duyệt điểm cho tất cả sinh viên?\n\n' +
      'Sau khi duyệt, bạn sẽ không thể chỉnh sửa hoặc duyệt lại được nữa.'
    );
    
    if (!confirmed) return;
    
    try {
      await postAccept(term);
      notify('Đã duyệt thành công!');
      setIsLocked(true); // Cập nhật trạng thái khóa
      fetchData(); // Tải lại danh sách
    } catch (error) {
      notify('Lỗi khi duyệt: ' + (error.response?.data?.message || error.message || 'Không xác định'), 'danger');
    }
  };

  const handleModalClose = (didSave) => {
    setSelectedStudent(null);
    if (didSave) {
      fetchData(); // Tải lại danh sách SV để cập nhật điểm
    }
  };

  const filteredStudents = students.filter((s) => {
    const msvMatch = s.student_code.toLowerCase().includes(formData.msv.toLowerCase());
    const nameMatch = s.full_name.toLowerCase().includes(formData.name.toLowerCase());
    return msvMatch && nameMatch;
  });

  const previewTemplate = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/drl/teacher-excel-preview?term_code=${encodeURIComponent(term)}&teacher_id=${encodeURIComponent(user.teacher_id)}`,
        {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${JSON.parse(localStorage.getItem("auth"))?.token || ""}`
          }
        }
      );

      setPreview(res.data);
      setIsPreviewOpen(true);
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
      const res = await axios.get(
        `${API_BASE}/api/drl/teacher-excel-template?term_code=${encodeURIComponent(term)}&teacher_id=${encodeURIComponent(user.teacher_id)}`,
        {
          responseType: 'blob',
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${JSON.parse(localStorage.getItem('auth'))?.token || ''}`
          }
        }
      );

      const blob = res.data;

      if (res.status !== 200) {
        throw new Error(`Tải file thất bại. Status: ${res.status}`);
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bao_cao_lop_${classCode}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Lỗi tải:", error.message || error);
      notify(error.message || "Đã xảy ra lỗi trong quá trình tải file.", 'danger');
    }
  };

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
            <th style={{ borderBottom: "none" }}>MSV</th>
            <th style={{ borderBottom: "none" }}>Họ tên</th>
            <th className="text-center" style={{ borderBottom: "none" }}>Tổng điểm</th>
            <th className="text-center" style={{ borderBottom: "none" }}>Tổng điểm mới</th>
            <th style={{ borderBottom: "none" }}></th>
            <th style={{ borderBottom: "none" }}></th>
          </tr>
          <tr>
            <th><Form.Control name="msv" value={formData.msv} onChange={(e) => setFormData({ ...formData, msv: e.target.value })} size='sm'></Form.Control></th>
            <th><Form.Control name="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} size='sm'></Form.Control></th>
            <th style={{ alignContent: 'center' }}></th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.map(s => (
            <tr key={s.student_code}>
              <td>{s.student_code}</td>
              <td>{s.full_name}</td>
              <td className="text-center">{s.old_score ?? 0}</td>
              <td className="text-center">{s.total_score ?? (s.old_score ?? 0)}</td>
              <td className="text-end">
                {/* Dùng Button variant="outline-primary" size="sm" */}
                <Button
                  className="btn-main"
                  variant='success'
                  size="sm"
                  onClick={() => setSelectedStudent({ code: s.student_code, note: s.note })}
                >
                  {page === 'teacher' && isLocked ? 'Xem' : 'Xem/Sửa'}
                </Button>
              </td>
              <td className="text-end">
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <>
      <Card>
        <Card.Body>
          {renderContent()}
        </Card.Body>
      </Card>

      {page === 'teacher' && (
        <div className="d-flex mt-3" style={{ justifyContent: "space-between" }}>
          <Button onClick={previewTemplate} variant="outline-success">
            <i className="fa-regular fa-file-excel m-2"></i>
            Xuất Excel
          </Button>

          <Button
            className="btn-main"
            variant={isLocked ? 'secondary' : 'success'}
            size="sm"
            onClick={handleApprove}
            disabled={isLocked}
          >
            {isLocked ? 'Đã duyệt' : 'Duyệt'}
          </Button>
        </div>
      )}

      {selectedStudent && (
        <StudentAssessmentModal
          studentCode={selectedStudent.code}
          noted={selectedStudent.note}
          term={term}
          onClose={handleModalClose}
          page={page}
          isLocked={page === 'teacher' && isLocked}
        />
      )}

      <Modal show={isPreviewOpen} onHide={() => setIsPreviewOpen(false)} size="xl" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Xem trước file Excel</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {preview && (
            <>
              <h5 className="text-center">{preview.title}</h5>
              <p>{preview.classInfo}</p>
              
              <Table striped bordered hover size="sm">
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
                      <td>{row.course}</td>
                      <td>{row.tc1}</td>
                      <td>{row.tc2}</td>
                      <td>{row.tc3}</td>
                      <td>{row.tc4}</td>
                      <td>{row.tc5}</td>
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
};

export default ClassStudentList;