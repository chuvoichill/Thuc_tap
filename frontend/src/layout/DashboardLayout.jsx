import { useState, useEffect } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { Container, Row, Card, Form } from 'react-bootstrap'; // Import components
import useAuth from '../hooks/useAuth';
import Header from '../components/common/Header';
import { roleVN } from '../utils/helpers';
import { getTerms } from '../services/drlService';

const DashboardLayout = () => {
  const { user } = useAuth();
  const [availableTerms, setAvailableTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [showHeader, setShowHeader] = useState(false);

  useEffect(() => {
    const fetchTerms = async () => {
      setLoadingTerms(true);
      try {
        const termsData = await getTerms();

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
  }, []);

  const handleValueFromHeader = (value) => {
    setShowHeader(value);
  }

  return (
    <>
      <Header show={handleValueFromHeader}/>
      <div className={`${showHeader ? 'showMenu' : 'hideMenu'}`}>
      {/* Dùng Container thay cho div.container-xxl */}
      <Container fluid="xxl" className="my-4 ctnBody">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">
            Xin chào, <span>{user.display_name}</span> ({roleVN(user.role)})
          </h4>
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">Kỳ học:</span>
            {/* Dùng Form.Select thay cho select.form-select */}
            <Form.Select
              size="sm"
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
            </Form.Select>
          </div>
        </div>

        {/* Dùng Row và Col thay cho div.row.g-3 và div.col-lg-X */}
        <Row className="g-3">
          {/* Dùng Card thay cho div.card.p-3 */}
          <Card body className="shadow-sm">
            {selectedTerm ? (
              <Outlet context={{ term: selectedTerm }} />
            ) : (
              !loadingTerms && <div className="text-muted text-center p-3">Vui lòng chọn hoặc tạo học kỳ.</div>
            )}
          </Card>
        </Row>
      </Container></div>
    </>
  );
};

// Hook useTerm giữ nguyên
export const useTerm = () => {
  return useOutletContext();
};

export default DashboardLayout;