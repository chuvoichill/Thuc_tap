import React, { useState, useEffect, useCallback } from 'react';
import { useTerm } from '../../layout/DashboardLayout'; // Lấy term hiện tại từ layout
import useAuth from '../../hooks/useAuth'; // Lấy thông tin user (student_code)
import useNotify from '../../hooks/useNotify'; // Hiển thị thông báo (Toast)
import { getCriteria, getSelfAssessment, saveSelfAssessment } from '../../services/drlService'; // Các hàm gọi API
import api from '../../services/api'; // Import trực tiếp api service để gọi API status
import LoadingSpinner from '../../components/common/LoadingSpinner'; // Component loading
import AssessmentForm from '../../components/drl/AssessmentForm'; // Component form đánh giá

const SelfAssessmentPage = () => {
  const { term } = useTerm(); // Lấy mã học kỳ đang chọn (ví dụ: '2025HK1')
  const { user } = useAuth(); // Lấy thông tin người dùng (chứa student_code)
  const { notify } = useNotify(); // Hàm để gọi Toast

  // State lưu trữ dữ liệu
  const [criteria, setCriteria] = useState([]); // Danh sách tiêu chí
  const [selfData, setSelfData] = useState([]); // Dữ liệu tự đánh giá đã lưu của SV
  const [loading, setLoading] = useState(true); // Trạng thái đang tải dữ liệu
  const [saving, setSaving] = useState(false); // Trạng thái đang lưu
  const [error, setError] = useState(null); // Lỗi nếu có
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(true); // Trạng thái Mở/Khóa đánh giá

  // Hàm tải dữ liệu (tiêu chí, điểm đã lưu, trạng thái kỳ)
  const fetchData = useCallback(async () => {
    // Chỉ tải khi có term và student_code
    if (!term || !user?.student_code) return;

    setLoading(true); // Bắt đầu tải
    setError(null); // Xóa lỗi cũ
    setIsAssessmentOpen(true); // Mặc định là mở cho đến khi có kết quả API
    try {
      // Gọi đồng thời 3 API để lấy dữ liệu
      const [critRes, selfRes, statusRes] = await Promise.all([
          getCriteria(term), // Lấy danh sách tiêu chí của kỳ này
          getSelfAssessment(user.student_code, term), // Lấy điểm SV đã tự chấm (nếu có)
          api.get(`/api/terms/${term}/status`) // Gọi API kiểm tra trạng thái Mở/Khóa
          // Lưu ý: API `/api/admin/terms/${term}/status` cần được tạo ở backend
      ]);
      setCriteria(critRes || []); // Cập nhật state tiêu chí
      setSelfData(selfRes || []); // Cập nhật state điểm đã lưu
      // Cập nhật state Mở/Khóa dựa trên kết quả API status
      setIsAssessmentOpen(statusRes?.isAssessmentOpen !== undefined ? statusRes.isAssessmentOpen : true);

    } catch (e) {
      // Xử lý lỗi
      setError('Không tải được dữ liệu đánh giá: ' + e.message);
      setIsAssessmentOpen(false); // An toàn nhất là coi như bị khóa nếu có lỗi tải status
    }
    setLoading(false); // Kết thúc tải
  }, [term, user?.student_code]); // Dependency: Hàm sẽ chạy lại nếu term hoặc user thay đổi

  // Gọi fetchData khi component mount hoặc fetchData thay đổi
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hàm xử lý khi người dùng bấm nút "Gửi đánh giá" (được gọi từ AssessmentForm)
  const handleSubmit = async (items, total) => {
    // Kiểm tra lại lần nữa trước khi gửi đi (phòng trường hợp state chưa kịp cập nhật)
    if (!isAssessmentOpen) {
        notify('Kỳ đánh giá này đã bị khóa.', 'warning');
        return;
    }
    setSaving(true); // Bắt đầu lưu
    try {
      // Gọi API lưu điểm
      await saveSelfAssessment(user.student_code, term, items);
      notify('Đã lưu đánh giá thành công!'); // Thông báo thành công
      // Không cần tải lại dữ liệu vì AssessmentForm đã tự cập nhật điểm
    } catch (e) {
      // Xử lý lỗi từ API (ví dụ: bị khóa đột ngột, lỗi server)
      if (e.message === 'assessment_period_closed') {
         notify('Kỳ đánh giá đã bị khóa. Không thể lưu.', 'danger');
         setIsAssessmentOpen(false); // Cập nhật lại trạng thái khóa
      } else {
         notify('Lỗi khi lưu: ' + e.message, 'danger'); // Thông báo lỗi chung
      }
    }
    setSaving(false); // Kết thúc lưu
  };

  // Render UI
  if (loading) return <LoadingSpinner />; // Hiển thị loading nếu đang tải
  if (error) return <div className="alert alert-danger">{error}</div>; // Hiển thị lỗi nếu có

  // Render nội dung chính
  return (
    <div>
      <div className="section-title mb-3">
        <i className="bi bi-clipboard2-check me-2"></i>
        TỰ ĐÁNH GIÁ – Kỳ <span className="fw-bold">{term}</span>
      </div>

      {/* Hiển thị thông báo nếu kỳ đánh giá bị khóa */}
      {!isAssessmentOpen && (
        <div className="alert alert-warning">
          <i className="bi bi-lock-fill me-2"></i> Kỳ đánh giá này đã được khóa. Bạn không thể chỉnh sửa.
        </div>
      )}

      {/* Component Form đánh giá */}
      <AssessmentForm
        criteria={criteria}
        selfData={selfData}
        onSubmit={handleSubmit} // Truyền hàm xử lý submit xuống
        isSaving={saving} // Truyền trạng thái đang lưu xuống
        readOnly={!isAssessmentOpen} // Form sẽ bị vô hiệu hóa nếu kỳ bị khóa
      />
    </div>
  );
};

export default SelfAssessmentPage; // Export component