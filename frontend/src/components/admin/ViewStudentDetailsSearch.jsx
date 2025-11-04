import React, { useState, useEffect, useCallback } from 'react';
import { useTerm } from '../../layout/DashboardLayout'; // Lấy term hiện tại từ layout
import useAuth from '../../hooks/useAuth'; // Lấy thông tin student (student_code)
import useNotify from '../../hooks/useNotify'; // Hiển thị thông báo (Toast)
import { getCriteria, getSelfAssessment, saveSelfAssessment } from '../../services/drlService'; // Các hàm gọi API
import api from '../../services/api'; // Import trực tiếp api service để gọi API status
import LoadingSpinner from '../../components/common/LoadingSpinner'; // Component loading
import AssessmentForm from '../../components/drl/AssessmentForm'; // Component form đánh giá

const ViewStudentDetailsSearch = ({student}) => {
    const { notify } = useNotify(); // Hàm để gọi Toast

    // State lưu trữ dữ liệu
    const [criteria, setCriteria] = useState([]); // Danh sách tiêu chí
    const [selfData, setSelfData] = useState([]); // Dữ liệu tự đánh giá đã lưu của SV
    const [loading, setLoading] = useState(true); // Trạng thái đang tải dữ liệu
    const [saving, setSaving] = useState(false); // Trạng thái đang lưu
    const [error, setError] = useState(null); // Lỗi nếu có


    // Hàm tải dữ liệu (tiêu chí, điểm đã lưu, trạng thái kỳ)
    const fetchData = useCallback(async () => {
        // Chỉ tải khi có term và student_code
        if (!student.term || !student?.student_code) return;

        setLoading(true); // Bắt đầu tải
        setError(null); // Xóa lỗi cũ

        try {
            // Gọi đồng thời 3 API để lấy dữ liệu
            const [critRes, selfRes, statusRes] = await Promise.all([
                getCriteria(student.term), // Lấy danh sách tiêu chí của kỳ này
                getSelfAssessment(student.student_code, student.term), // Lấy điểm SV đã tự chấm (nếu có)
                api.get(`/api/terms/${student.term}/status`) // Gọi API kiểm tra trạng thái Mở/Khóa
                // Lưu ý: API `/api/admin/terms/${term}/status` cần được tạo ở backend
            ]);
            setCriteria(critRes || []); // Cập nhật state tiêu chí
            setSelfData(selfRes || []); // Cập nhật state điểm đã lưu
            // Cập nhật state Mở/Khóa dựa trên kết quả API status


        } catch (e) {
            // Xử lý lỗi
            setError('Không tải được dữ liệu đánh giá: ' + e.message);

        }
        setLoading(false); // Kết thúc tải
    }, [student.term, student?.student_code]); // Dependency: Hàm sẽ chạy lại nếu term hoặc student thay đổi

    // Gọi fetchData khi component mount hoặc fetchData thay đổi
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Hàm xử lý khi người dùng bấm nút "Gửi đánh giá" (được gọi từ AssessmentForm)
    const handleSubmit = async (items, total) => {
        setSaving(true); // Bắt đầu lưu
        try {
            // Gọi API lưu điểm
            await saveSelfAssessment(student.student_code, student.term, items);
            notify('Đã lưu đánh giá thành công!'); // Thông báo thành công
            // Không cần tải lại dữ liệu vì AssessmentForm đã tự cập nhật điểm
        } catch (e) {
            notify('Lỗi khi lưu: ' + e.message, 'danger'); // Thông báo lỗi chung

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
                ĐÁNH GIÁ – Kỳ <span className="fw-bold">{student.term}</span>
            </div>

            {/* Component Form đánh giá */}
            <AssessmentForm
                criteria={criteria}
                selfData={selfData}
                onSubmit={handleSubmit} // Truyền hàm xử lý submit xuống
                isSaving={saving} // Truyền trạng thái đang lưu xuống
                readOnly={false}
            />
        </div>
    );
};

export default ViewStudentDetailsSearch;