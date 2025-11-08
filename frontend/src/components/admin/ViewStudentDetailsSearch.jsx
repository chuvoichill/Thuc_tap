import React, { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-bootstrap'; // Import Alert
import { getCriteria, getSelfAssessment, saveSelfAssessment } from '../../services/drlService';
import api from '../../services/api'; 
import LoadingSpinner from '../../components/common/LoadingSpinner'; 
import AssessmentForm from '../../components/drl/AssessmentForm'; 
import useNotify from '../../hooks/useNotify'; 

const ViewStudentDetailsSearch = ({student}) => {
    const { notify } = useNotify(); 

    const [criteria, setCriteria] = useState([]); 
    const [selfData, setSelfData] = useState([]); 
    const [loading, setLoading] = useState(true); 
    const [saving, setSaving] = useState(false); 
    const [error, setError] = useState(null); 


    // Hàm tải dữ liệu
    const fetchData = useCallback(async () => {
        if (!student.term || !student?.student_code) return;

        setLoading(true); 
        setError(null); 

        try {
            const [critRes, selfRes] = await Promise.all([
                getCriteria(student.term), 
                getSelfAssessment(student.student_code, student.term), 
                // Không dùng statusRes ở đây vì không cần isAssessmentOpen
            ]);
            setCriteria(critRes || []); 
            setSelfData(selfRes || []); 
        } catch (e) {
            setError('Không tải được dữ liệu đánh giá: ' + e.message);
        }
        setLoading(false);
    }, [student.term, student?.student_code]); 

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Hàm xử lý khi người dùng bấm nút "Gửi đánh giá"
    const handleSubmit = async (items, total) => {
        setSaving(true); 
        try {
            await saveSelfAssessment(student.student_code, student.term, items);
            notify('Đã lưu đánh giá thành công!'); 
        } catch (e) {
            notify('Lỗi khi lưu: ' + e.message, 'danger'); 
        }
        setSaving(false); 
    };

    // Render UI
    if (loading) return <LoadingSpinner />; 
    // Dùng Alert variant="danger" thay cho div.alert.alert-danger
    if (error) return <Alert variant="danger">{error}</Alert>; 

    // Render nội dung chính
    return (
        <div>
            <div className="section-title mb-3">
                <i className="bi bi-clipboard2-check me-2"></i>
                ĐÁNH GIÁ – Kỳ <span className="fw-bold">{student.term}</span>
            </div>

            <AssessmentForm
                criteria={criteria}
                selfData={selfData}
                onSubmit={handleSubmit}
                isSaving={saving}
                readOnly={false}
            />
        </div>
    );
};

export default ViewStudentDetailsSearch;