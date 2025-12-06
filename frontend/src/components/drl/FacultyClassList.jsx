// frontend/src/components/drl/FacultyClassList.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Alert, Button, Modal, Form } from 'react-bootstrap'; // Import components
import { useTerm } from '../../layout/DashboardLayout';
import useAuth from '../../hooks/useAuth';
import { getAdminClasses, getFacultyClasses } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';
import ClassStudentList from './ClassStudentList';
import HSVStudentList from './HSVStudentList';
import axios from 'axios';
const FacultyClassList = ({ facultyCode, setFaculty }) => {
  const { term } = useTerm();
  const { user } = useAuth();


  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [classCode, setClassCode] = useState('');


  const [showClassModal, setShowClassModal] = useState(false); // State quản lý Modal

  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

  const fetchData = useCallback(async () => {
    if (!term || !user?.role) return;
    setLoading(true);
    setError(null);
    setSelectedClass(null);
    try {
      let res;
      if (user.role === 'faculty') {
        res = await getFacultyClasses(user.faculty_code, term);
        if (setFaculty) setFaculty(user.faculty_code || null);
      } else if (user.role === 'admin') {
        if (!facultyCode) throw new Error('Thiếu facultyCode cho admin');
        res = await getAdminClasses(term, facultyCode);
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
  }, [term, user?.role, user?.username, facultyCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenClassModal = (fac) => {
    setSelectedClass(fac);
    setShowClassModal(true);
  };

  const handleCloseClassModal = () => {
    setShowClassModal(false);
    setSelectedClass(null);
    // Không cần fetchData() trừ khi FacultyClassList có thay đổi điểm
    // Giữ nguyên logic đóng modal:
    // setFaculties(null); // Dòng này có vẻ sai logic trong code gốc (setFaculties(null) trong handleModalClose)
  };

  const filteredClasses = classes.filter(c => {
    const matchesClassCode = c.class_code.toLowerCase().includes(classCode.toLowerCase());
    return matchesClassCode;
  });

  const previewTemplate = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/drl/excel-preview?term_code=${encodeURIComponent(term)}&faculty_code=${encodeURIComponent(user.faculty_code)}`,
        {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${JSON.parse(localStorage.getItem("auth"))?.token || ""}`
          }
        }
      );

      setPreview(res.data);  // Lưu JSON preview
      setIsPreviewOpen(true); // Mở modal preview
    } catch (err) {
      console.error("Lỗi preview:", err);
      alert("Không thể xem trước file.");
    }
  };

  const downloadTemplate = async () => {
    try {
      // 1. Dùng axios gốc và Tắt responseType mặc định
      const res = await axios.get(
        `${API_BASE}/api/drl/excel-template?term_code=${encodeURIComponent(term)}&faculty_code=${encodeURIComponent(user.faculty_code)}`,
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
      alert(error.message || "Đã xảy ra lỗi trong quá trình tải file.");
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
                  <th>Mã lớp</th>
                  <th className="text-end">Sĩ số</th>
                  <th className="text-end">ĐRL TB</th>
                  <th></th>
                </tr>
                <tr>
                  <th><Form.Control name="classCode" onChange={(e) => setClassCode(e.target.value)} size='sm'></Form.Control></th>
                  <th style={{alignContent:'center'}}><i className="fa-solid fa-magnifying-glass"></i></th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((c) => (
                  <tr key={c.class_code}>
                    <td>{c.class_code}</td>
                    <td className="text-end">{c.total_students ?? 0}</td>
                    <td className="text-end">
                      {c.avg_score == null ? '—' : Number(c.avg_score).toFixed(2)}
                    </td>
                    <td className="text-end">
                      {/* Dùng Button variant="outline-primary" size="sm" */}
                      <Button
                        size="sm"
                        variant='success'
                        className="btn-main"
                        onClick={() => handleOpenClassModal(c.class_code)}
                      >
                        Xem sinh viên
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Button onClick={previewTemplate} variant="outline-success" className="mt-3 me-2">
        <i className="fa-regular fa-file-excel m-2"></i>
        Xuất Excel
      </Button>

      {/* Khi chọn một lớp, component ClassStudentList sẽ hiện ra */}


      {/* Modal hiển thị danh sách lớp của khoa */}
      <Modal
        show={showClassModal}
        onHide={handleCloseClassModal}
        keyboard={false}
        size="lg" // Thay thế modal-lg
        scrollable // Thay thế modal-dialog-scrollable
      >
        <Modal.Header closeButton>
          {/* Dùng title động dựa trên selectedFaculty */}
          <Modal.Title id="staticBackdropLabel">
            {selectedClass ? `Danh sách sinh viên lớp ${selectedClass}` : 'Danh sách lớp'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedClass && (
            <div className="mt-3">
              {user?.role === 'hsv' ? (
                <HSVStudentList
                  classCode={selectedClass}
                  term={term} />
              ) : (
                <ClassStudentList classCode={selectedClass} term={term} />
              )}
            </div>
          )}
        </Modal.Body>
      </Modal>
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
          <Button variant="secondary" onClick={() => setIsPreviewOpen(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

    </>
  );
}
export default FacultyClassList;