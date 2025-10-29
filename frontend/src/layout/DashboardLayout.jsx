import React, { useState, useEffect } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import { roleVN } from '../utils/helpers';
// --- SỬA IMPORT NÀY ---
// import { getAdminTerms } from '../services/drlService'; // Bỏ dòng này
import { getTerms } from '../services/drlService'; // Import hàm getTerms mới
// --- HẾT SỬA ---


const DashboardLayout = () => {
  const { user } = useAuth();
  const [availableTerms, setAvailableTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [loadingTerms, setLoadingTerms] = useState(true);

  useEffect(() => {
    const fetchTerms = async () => {
      setLoadingTerms(true);
      try {
        // --- SỬA HÀM GỌI API Ở ĐÂY ---
        // const termsData = await getAdminTerms({ sortBy: 'year_desc,semester_desc' });
        const termsData = await getTerms({ sortBy: 'year_desc,semester_desc' }); // Gọi hàm getTerms mới
        // --- HẾT SỬA ---

        setAvailableTerms(termsData || []);

        if (termsData && termsData.length > 0) {
          const defaultTerm =
            termsData.find(t => t.is_assessment_open) ||
            termsData.find(t => t.is_active) ||
            termsData[0];
          setSelectedTerm(defaultTerm.code);
        } else {
          setSelectedTerm('');
        }
      } catch (error) {
        console.error("Failed to fetch terms:", error);
        setAvailableTerms([]);
        setSelectedTerm('');
      }
      setLoadingTerms(false);
    };

    fetchTerms();
  }, []); // Chỉ chạy 1 lần

  return (
    <>
      <Navbar />

      <main className="container-xxl my-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">
            Xin chào, <span>{user.display_name}</span> ({roleVN(user.role)})
          </h4>
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">Kỳ học:</span>
            {/* Dropdown giữ nguyên logic hiển thị */}
            <select
              className="form-select form-select-sm"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              style={{ minWidth: '120px' }}
              disabled={loadingTerms || availableTerms.length === 0}
            >
              {loadingTerms ? (
                <option>Đang tải...</option>
              ) : availableTerms.length === 0 ? (
                <option>Không có kỳ</option>
              ) : (
                availableTerms.map(t => (
                  <option key={t.code} value={t.code}>
                    {t.code}
                    {t.is_assessment_open ? ' (Đang ĐG)' : t.is_active ? '' : ' (Đã đóng)'}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-lg-3">
            <Sidebar />
          </div>
          <div className="col-lg-9">
            <div className="card p-3">
              {selectedTerm ? (
                 <Outlet context={{ term: selectedTerm }} />
              ) : (
                 !loadingTerms && <div className="text-muted text-center p-3">Vui lòng chọn hoặc tạo học kỳ.</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

// Hook useTerm giữ nguyên
export const useTerm = () => {
  return useOutletContext();
};

export default DashboardLayout;