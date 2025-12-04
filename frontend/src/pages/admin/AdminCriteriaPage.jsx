import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, InputGroup, Spinner, Modal } from 'react-bootstrap'; // Import components
import { useTerm } from '../../layout/DashboardLayout';
import useNotify from '../../hooks/useNotify';
import {
  getCriteria, createCriterion, updateCriterion, deleteCriterion,
  updateCriterionOptions, getTerms, copyCriteriaFromTerm, getAdminGroups, deleteAllCriteriaAdmin
} from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Template dữ liệu cho tiêu chí mới
const newCriterionTemplate = {
  id: null, code: '', title: '', type: 'radio',
  max_points: '', options: []
};

const AdminCriteriaPage = () => {
  const { term: currentTargetTerm } = useTerm();
  const { notify } = useNotify();

  // Helper functions for validation - NOT blocking input
  const isValidInteger = (value) => {
    if (value === '' || value === null || value === undefined) return true;
    const str = String(value);
    return /^\d+$/.test(str);
  };

  const getMaxPointsError = (value) => {
    if (value === '' || value === null || value === undefined) return 'Điểm tối đa là bắt buộc';
    if (!isValidInteger(value)) return 'Chỉ được nhập số nguyên';
    const num = Number(value);
    if (num < 0) return 'Không được nhập số âm';
    if (num > 1000) return 'Không được vượt quá 1000';
    if (!Number.isSafeInteger(num)) return 'Số quá lớn';
    return null;
  };

  const getTitleError = (value) => {
    if (!value || !value.trim()) return 'Tiêu đề là bắt buộc';
    return null;
  };

  const getLabelError = (value) => {
    if (!value || !value.trim()) return 'Nhãn hiển thị là bắt buộc';
    return null;
  };

  // --- State quản lý dữ liệu ---
  const [groups, setGroups] = useState([]);
  const [allCriteria, setAllCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- State quản lý giao diện ---
  const [filterGroup, setFilterGroup] = useState('');
  const [currentCriterion, setCurrentCriterion] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});

  // --- State cho chức năng sao chép ---
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [allTerms, setAllTerms] = useState([]);
  const [sourceTerm, setSourceTerm] = useState('');
  const [isCopying, setIsCopying] = useState(false);

  // Ref để tìm kiếm form (nếu cần)
  const formRef = useRef(null);

  // --- Hàm tải dữ liệu chính ---
  const fetchData = useCallback(async () => {
    if (!currentTargetTerm) return;
    setLoading(true);
    setError(null);
    setCurrentCriterion(null);
    setFilterGroup('');
    try {
      const [criteriaData, termsData, groupsData] = await Promise.all([
        getCriteria(currentTargetTerm),
        getTerms({ sortBy: 'year_desc,semester_desc' }),
        getAdminGroups(currentTargetTerm)
      ]);

      setGroups(groupsData || []);
      setAllCriteria(criteriaData || []);
      setAllTerms(termsData || []);

      const currentTermIndex = (termsData || []).findIndex(t => t.code === currentTargetTerm);
      if (currentTermIndex >= 0 && currentTermIndex + 1 < termsData.length) {
        setSourceTerm(termsData[currentTermIndex + 1]?.code || '');
      } else if (termsData?.length > 1) {
        setSourceTerm(termsData.find(t => t.code !== currentTargetTerm)?.code || '');
      } else {
        setSourceTerm('');
      }

    } catch (e) {
      setError('Lỗi tải dữ liệu Quản trị Tiêu chí: ' + e.message);
    }
    setLoading(false);
  }, [currentTargetTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Logic quản lý Modal Sao chép đã được đơn giản hóa ---
  // Không cần useEffect phức tạp để quản lý instance nữa, React-Bootstrap lo việc đó.
  const handleCopyModalClose = () => {
    setShowCopyModal(false);
  };

  // --- Lọc danh sách tiêu chí hiển thị bên trái ---
  const filteredCriteria = useMemo(() => {
    if (!filterGroup) {
      return allCriteria.filter(c => String(c.code || '').includes('.'));
    }
    return allCriteria.filter(c => String(c.code || '').startsWith(`${filterGroup}.`));
  }, [allCriteria, filterGroup]);

  // --- Chọn một tiêu chí từ danh sách để sửa ---
  const selectCriterion = (crit) => {
    // FIX ISSUE 1: Lấy group_no từ group_code trả về từ API
    const group_no = crit.group_code || (crit.code ? Number(String(crit.code).split('.')[0].replace(/\D/g, '')) : '');

    setCurrentCriterion({
      ...JSON.parse(JSON.stringify(crit)),
      group_no: group_no,
      require_hsv_verify: crit.require_hsv_verify || false
    });
    setTouchedFields({}); // Reset touched state
  };

  // --- Cập nhật state của form khi người dùng nhập liệu ---
  // LUÔN cập nhật state, KHÔNG chặn input
  const handleFormChange = (e) => {
    const { name, value } = e.target;

    // Mark field as touched
    setTouchedFields(prev => ({ ...prev, [name]: true }));

    // Lưu giá trị như người dùng nhập, không convert ngay
    setCurrentCriterion(prev => ({ ...prev, [name]: value }));

    if (name === 'code') {
      updateOrderFromCode(value);
    }
  };

  // --- Tự động cập nhật thứ tự dựa trên mã tiêu chí ---
  const updateOrderFromCode = (code) => {
    const parts = String(code || '').split('.');
    const sub = Number(parts[parts.length - 1]?.replace(/\D/g, '')) || 0;
    setCurrentCriterion(prev => ({ ...prev, display_order: (sub > 0 ? sub : 999) }));
  };

  // --- Gợi ý mã tiêu chí tiếp theo cho nhóm đang chọn ---
  const suggestNextCode = () => {
    const gno = Number(currentCriterion?.group_no || filterGroup || groups[0]?.code || 1);
    let maxSub = 0;
    allCriteria.forEach(c => {
      const parts = String(c.code || '').split('.');
      const critGroupNo = Number(parts[0]?.replace(/\D/g, '')) || 0;
      if (critGroupNo === gno) {
        const sub = Number(parts[parts.length - 1]?.replace(/\D/g, '')) || 0;
        if (sub > maxSub) maxSub = sub;
      }
    });
    const newCode = `${gno}.${maxSub + 1}`;
    setCurrentCriterion(prev => ({ ...prev, code: newCode, group_no: gno }));
    updateOrderFromCode(newCode);
  };

  const handleDeleteAllCriteria = async () => {
    if (!window.confirm(`Xóa tất cả tiêu chí trong kỳ ${currentTargetTerm}? Hành động này không thể hoàn tác.`)) {
      return;
    }
    setIsSaving(true);
    try {
      await deleteAllCriteriaAdmin(currentTargetTerm);
      notify('Đã xóa tất cả tiêu chí!', 'info');
      setCurrentCriterion(null);
      await fetchData();
    } catch (e) { notify('Lỗi khi xóa: ' + e.message, 'danger'); }
    setIsSaving(false);
  };

  // --- Xử lý khi bấm nút "Thêm tiêu chí" ---
  const handleNew = () => {
    const gno = Number(filterGroup || groups[0]?.code || 1);
    setCurrentCriterion({
      ...newCriterionTemplate,
      group_no: gno,
      term_code: currentTargetTerm,
      require_hsv_verify: false,
      options: [{ id: null, label: '', score: 0 }]
    });
    setTouchedFields({}); // Reset touched state for new criterion
    setTimeout(() => suggestNextCode(), 0);
  };

  // --- Xử lý thay đổi trong bảng Options ---
  // LUÔN cập nhật state, KHÔNG chặn input
  const handleOptChange = (index, field, value) => {
    // Mark option field as touched
    setTouchedFields(prev => ({ ...prev, [`option_${index}_${field}`]: true }));

    const newOptions = [...(currentCriterion.options || [])];

    // Lưu giá trị như người dùng nhập
    newOptions[index] = {
      ...newOptions[index],
      [field]: value
    };
    setCurrentCriterion(prev => ({ ...prev, options: newOptions }));
  };

  // --- Thêm một dòng option mới ---
  const addOptRow = () => {
    const newOpt = {
      id: null, label: '', score: 0
    };
    setCurrentCriterion(prev => ({ ...prev, options: [...(prev.options || []), newOpt] }));
  };

  // --- Xóa một dòng option ---
  const delOptRow = (index) => {
    setCurrentCriterion(prev => ({ ...prev, options: (prev.options || []).filter((_, i) => i !== index) }));
  };

  // --- Xử lý Lưu tiêu chí ---
  // Validate TOÀN BỘ trước khi lưu
  const handleSave = async () => {
    const errors = [];

    // Validate các trường bắt buộc
    if (!currentCriterion || !currentCriterion.code?.trim()) {
      errors.push('Mã tiêu chí là bắt buộc');
    }
    if (!currentCriterion?.title?.trim()) {
      errors.push('Tiêu đề tiêu chí là bắt buộc');
    }
    if (!currentCriterion?.group_no) {
      errors.push('Vui lòng chọn nhóm tiêu chí');
    }

    // Validate max_points
    const maxPointsError = getMaxPointsError(currentCriterion?.max_points);
    if (maxPointsError) {
      errors.push(`Điểm tối đa: ${maxPointsError}`);
    }

    const maxPoints = Number(currentCriterion?.max_points) || 0;

    // Validate loại radio
    if (currentCriterion?.type === 'radio') {
      const validOptions = (currentCriterion.options || []).filter(opt => opt.label?.trim());
      if (validOptions.length === 0) {
        errors.push('Tiêu chí loại Radio phải có ít nhất một lựa chọn');
      }

      // Validate từng option
      (currentCriterion.options || []).forEach((opt, idx) => {
        if (!opt.label?.trim()) return; // Skip empty options

        const score = opt.score;
        if (score === '' || score === null || score === undefined) {
          errors.push(`Lựa chọn #${idx + 1}: Điểm là bắt buộc`);
        } else if (!isValidInteger(score)) {
          errors.push(`Lựa chọn #${idx + 1}: Điểm phải là số nguyên`);
        } else {
          const scoreNum = Number(score);
          if (scoreNum < 0) {
            errors.push(`Lựa chọn #${idx + 1}: Điểm không được âm`);
          }
          if (maxPoints > 0 && scoreNum > maxPoints) {
            errors.push(`Lựa chọn #${idx + 1}: Điểm (${scoreNum}) vượt quá điểm tối đa (${maxPoints})`);
          }
        }
      });
    }

    // Hiển thị TẤT CẢ lỗi nếu có
    if (errors.length > 0) {
      notify(
        <div>
          <strong>Vui lòng sửa các lỗi sau:</strong>
          <ul className="mb-0 mt-1 ps-3">
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>,
        'danger'
      );
      return;
    }

    // Nếu không có lỗi, convert sang số và lưu
    setIsSaving(true);
    try {
      const { id, options, ...dataToSave } = currentCriterion;

      // Convert string sang number
      dataToSave.max_points = Number(dataToSave.max_points);
      dataToSave.display_order = Number(dataToSave.display_order) || 999;
      dataToSave.group_no = Number(dataToSave.group_no);

      let savedCriterion;
      if (id) { savedCriterion = await updateCriterion(id, dataToSave); }
      else { savedCriterion = await createCriterion(dataToSave); }

      if (savedCriterion.type === 'radio') {
        const validOptions = (options || [])
          .filter(opt => opt.label?.trim())
          .map(opt => ({
            ...opt,
            score: Number(opt.score),
            display_order: Number(opt.display_order) || 1
          }));
        await updateCriterionOptions(savedCriterion.id, validOptions);
      }
      notify('Đã lưu tiêu chí!', 'success');
      await fetchData();
      const freshData = await getCriteria(currentTargetTerm);
      const newlySaved = freshData.find(c => c.id === savedCriterion.id);
      if (newlySaved) { selectCriterion(newlySaved); }
      else { setCurrentCriterion(null); }

    } catch (e) {
      notify('Lỗi khi lưu: ' + e.message, 'danger');
    }
    setIsSaving(false);
  };

  // --- Xử lý Xóa tiêu chí ---
  const handleDelete = async () => {
    const id = currentCriterion?.id;
    if (!id) return;
    if (!window.confirm(`Xóa tiêu chí "${currentCriterion.code} - ${currentCriterion.title}"? Dữ liệu tự chấm và lựa chọn liên quan sẽ MẤT.`)) {
      return;
    }
    setIsSaving(true);
    try {
      await deleteCriterion(id);
      notify('Đã xóa tiêu chí!', 'info');
      setCurrentCriterion(null);
      await fetchData();
    } catch (e) { notify('Lỗi khi xóa: ' + e.message, 'danger'); }
    setIsSaving(false);
  };

  // --- Xử lý Sao chép tiêu chí ---
  const handleCopyCriteria = async () => {
    if (!sourceTerm || sourceTerm === currentTargetTerm) {
      notify('Vui lòng chọn kỳ nguồn hợp lệ.', 'warning'); return;
    }
    if (!window.confirm(`Sao chép TOÀN BỘ tiêu chí từ kỳ ${sourceTerm} sang kỳ ${currentTargetTerm}? Hành động này KHÔNG thể hoàn tác và sẽ thất bại nếu kỳ ${currentTargetTerm} đã có tiêu chí.`)) {
      return;
    }
    setIsCopying(true);
    try {
      const result = await copyCriteriaFromTerm(sourceTerm, currentTargetTerm);
      notify(result.message || 'Sao chép thành công!', 'success');
      handleCopyModalClose(); // Đóng modal
      await fetchData();
    } catch (e) {
      if (e.response?.data?.error === 'target_term_already_has_criteria') {
        notify(e.response.data.message || `Kỳ ${currentTargetTerm} đã có tiêu chí.`, 'danger');
      } else {
        notify('Lỗi sao chép: ' + e.message, 'danger');
      }
    } finally { setIsCopying(false); }
  };

  // --- Render UI ---
  if (loading) return <LoadingSpinner />;
  // Dùng Alert variant="danger"
  if (error) return <Alert variant="danger">Lỗi tải dữ liệu: {error}</Alert>;

  const sourceTermOptions = allTerms.filter(t => t.code !== currentTargetTerm);

  return (
    <Container fluid>
      {/* Tiêu đề trang và nút Sao chép */}
      <div className="d-flex justify-content-between align-items-center mb-3 ">
        <div className="section-title mb-0">
          <i className="bi bi-sliders2 me-2"></i>
          QUẢN TRỊ TIÊU CHÍ – Kỳ <b>{currentTargetTerm}</b>
        </div>
        <Button
          variant="outline-success"
          size="sm"
          onClick={() => setShowCopyModal(true)}
          disabled={loading}
        >
          <i className="bi bi-clipboard-plus me-1"></i> Sao chép từ kỳ trước...
        </Button>
      </div>

      {/* Layout 2 cột */}
      <Row className="g-3">
        {/* Cột trái: Danh sách tiêu chí */}
        <Col lg={5}>
          <Card>
            <Card.Header className="d-flex align-items-center justify-content-between">
              {/* Dropdown lọc theo nhóm */}
              <div className="d-flex align-items-center gap-2">
                <Form.Label className="small text-muted mb-0"><span style={{ color: "white" }}>Nhóm:</span></Form.Label>
                <Form.Select
                  size="sm"
                  style={{ minWidth: '200px' }}
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                >
                  <option value="">Tất cả nhóm</option>
                  {groups.map(g => (
                    <option key={g.id || g.code} value={g.code}>{g.title} (Nhóm {g.code})</option>
                  ))}
                </Form.Select>
              </div>
            </Card.Header>
            {/* Bảng danh sách tiêu chí */}
            <Card.Body className="p-0">
              <div className="table-responsive" style={{ maxHeight: '62vh' }}>
                <Table hover size="sm" className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Mã</th>
                      <th>Tiêu đề</th>
                      <th className="text-end" style={{ width: '60px' }}>Điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCriteria.length === 0 ? (
                      <tr><td colSpan="3" className="text-center text-muted py-3">Không có tiêu chí nào.</td></tr>
                    ) : (
                      filteredCriteria.map(c => (
                        <tr
                          key={c.id}
                          onClick={() => selectCriterion(c)}
                          style={{ cursor: 'pointer' }}
                          className={currentCriterion?.id === c.id ? 'table-primary' : ''}
                        >
                          <td className="fw-semibold">{c.code}</td>
                          <td>{c.title}</td>
                          <td className="text-end">{c.max_points}</td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
            {/* Nút thêm mới */}
            <Card.Footer className="d-flex gap-2 justify-content-end">
              <Button size="sm" variant='danger' onClick={handleDeleteAllCriteria}>
                Xóa tất cả tiêu chí
              </Button>
              <Button size="sm" variant='success' className="btn-main" onClick={handleNew}>
                Thêm tiêu chí
              </Button>
            </Card.Footer>
          </Card>
        </Col>

        {/* Cột phải: Form chi tiết tiêu chí */}
        <Col lg={7}>
          {currentCriterion ? (
            <Card>
              <Card.Header>
                {currentCriterion.id ? `Chi tiết: ${currentCriterion.code}` : 'Thêm tiêu chí mới'}
              </Card.Header>
              <Card.Body>
                {/* Form tiêu chí */}
                <Form ref={formRef} onSubmit={(e) => e.preventDefault()}>
                  <Row className="g-2">
                    {/* Chọn nhóm */}
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label size="sm">Nhóm tiêu chí *</Form.Label>
                        <Form.Select
                          name="group_no"
                          size="sm"
                          value={currentCriterion.group_no || ''}
                          onChange={handleFormChange}
                          required
                        >

                          <option value="">-- Chọn nhóm --</option>
                          {groups.map(g => (
                            <option key={g.id || g.code} value={g.code}>{g.title} (Nhóm {g.code})</option>
                          ))}
                          {console.log("Current Groups:", groups)}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    {/* Mã tiêu chí */}
                    <Col md={6}>
                      <Form.Label size="sm">Mã tiêu chí *</Form.Label>
                      <InputGroup size="sm">
                        <Form.Control
                          name="code"
                          placeholder="vd: 1.1"
                          value={currentCriterion.code || ''}
                          onChange={handleFormChange}
                          required
                        />
                        <Button className="btn-main" variant='success' onClick={suggestNextCode}>Gợi ý</Button>
                      </InputGroup>
                    </Col>
                    {/* Tiêu đề */}
                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label size="sm">Tiêu đề *</Form.Label>
                        <Form.Control
                          as="textarea"
                          name="title"
                          size="sm"
                          placeholder="Nội dung tiêu chí"
                          value={currentCriterion.title || ''}
                          onChange={handleFormChange}
                          onBlur={() => setTouchedFields(prev => ({ ...prev, title: true }))}
                          isInvalid={touchedFields.title && !!getTitleError(currentCriterion.title)}
                          required
                          rows={3}
                        />
                        <Form.Control.Feedback type="invalid">
                          {getTitleError(currentCriterion.title)}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>

                    {/* Loại tiêu chí */}
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label size="sm">Loại</Form.Label>
                        <Form.Select
                          name="type"
                          size="sm"
                          value={currentCriterion.type || 'radio'}
                          onChange={(e) => {
                            handleFormChange(e);
                            if (e.target.value === 'radio' && (!currentCriterion.options || currentCriterion.options.length === 0)) { addOptRow(); }
                          }}
                        >
                          <option value="radio">Radio (Lựa chọn)</option>
                          <option value="text">Text (Nhập liệu)</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    {/* Điểm tối đa */}
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label size="sm">Điểm tối đa *</Form.Label>
                        <Form.Control
                          name="max_points"
                          type="text"
                          size="sm"
                          value={currentCriterion.max_points ?? ''}
                          onChange={handleFormChange}
                          onBlur={() => setTouchedFields(prev => ({ ...prev, max_points: true }))}
                          inputMode="numeric"
                          placeholder="Nhập 0-1000"
                          isInvalid={touchedFields.max_points && !!getMaxPointsError(currentCriterion.max_points)}
                          required
                        />
                        <Form.Control.Feedback type="invalid">
                          {getMaxPointsError(currentCriterion.max_points)}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col xs={12}>
                      <Form.Group>
                        <Form.Check
                          className='customCheck'
                          style={{ boxShadow: "none" }}
                          checked={currentCriterion.require_hsv_verify || false}
                          onChange={(e) => setCurrentCriterion(prev => ({ ...prev, require_hsv_verify: e.target.checked }))}
                          label="Tiêu chí cần hội sinh viên xác nhận"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                </Form>

                {/* Form Options */}
                {currentCriterion.type === 'radio' && (
                  <div className='mt-3'>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="fw-semibold small">Các lựa chọn</div>
                      <Button size="sm" className="btn-main" variant='success' onClick={addOptRow}>
                        <i className="bi bi-plus-lg me-1"></i>Thêm
                      </Button>
                    </div>
                    <div className="table-responsive">
                      <Table size="sm" className="align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Nhãn hiển thị *</th>
                            <th style={{ width: '90px' }} className="text-end">Điểm *</th>
                            <th style={{ width: '50px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(currentCriterion.options || []).map((opt, i) => {
                            const maxPoints = Number(currentCriterion.max_points) || 0;
                            const scoreNum = Number(opt.score);
                            const hasScoreError = opt.label?.trim() && (
                              !opt.score ||
                              !isValidInteger(opt.score) ||
                              scoreNum < 0 ||
                              (maxPoints > 0 && scoreNum > maxPoints)
                            );

                            return (
                              <tr key={opt.id || i}>
                                <td>
                                  <Form.Control
                                    type="text"
                                    size="sm"
                                    placeholder='Nội dung lựa chọn'
                                    value={opt.label || ''}
                                    onChange={(e) => handleOptChange(i, 'label', e.target.value)}
                                    onBlur={() => setTouchedFields(prev => ({ ...prev, [`option_${i}_label`]: true }))}
                                    isInvalid={touchedFields[`option_${i}_label`] && !!getLabelError(opt.label)}
                                    required
                                  />
                                  <Form.Control.Feedback type="invalid">
                                    {getLabelError(opt.label)}
                                  </Form.Control.Feedback>
                                </td>
                                <td>
                                  <Form.Control
                                    type="text"
                                    size="sm"
                                    className="text-end"
                                    value={opt.score ?? ''}
                                    onChange={(e) => handleOptChange(i, 'score', e.target.value)}
                                    onBlur={() => setTouchedFields(prev => ({ ...prev, [`option_${i}_score`]: true }))}
                                    inputMode="numeric"
                                    placeholder="0"
                                    isInvalid={touchedFields[`option_${i}_score`] && hasScoreError}
                                    required
                                  />
                                </td>
                                <td>
                                  <Button size="sm" variant="outline-danger" onClick={() => delOptRow(i)}>
                                    Xóa
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                          {(!currentCriterion.options || currentCriterion.options.length === 0) && (
                            <tr><td colSpan="3" className="text-center text-muted small py-2">Chưa có lựa chọn nào. Bấm "Thêm" để tạo.</td></tr>
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                )}
              </Card.Body>
              {/* Footer Lưu/Xóa */}
              <Card.Footer className="d-flex gap-2 justify-content-end">
                {currentCriterion.id && (
                  <Button variant="danger" size="sm" type="button" disabled={isSaving} onClick={handleDelete}>
                    Xoá
                  </Button>
                )}
                <Button className="btn-main" variant='success' size="sm" type="button" disabled={isSaving} onClick={handleSave}>
                  {isSaving ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="bi bi-save me-1"></i>}
                  Lưu Tiêu chí
                </Button>
              </Card.Footer>
            </Card>
          ) : (
            // Hướng dẫn khi chưa chọn
            <Card>
              <Card.Body className="text-center text-muted p-5">
                <i className="bi bi-pencil-square fs-3"></i>
                <p className="mt-2">Hãy chọn một tiêu chí từ danh sách bên trái để xem/sửa chi tiết, hoặc bấm "**Thêm tiêu chí**" để tạo mới.</p>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* Modal Sao chép (Dùng component Modal) */}
      <Modal
        show={showCopyModal}
        onHide={handleCopyModalClose}
        keyboard={false}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Sao chép Tiêu chí</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Chọn kỳ học nguồn để sao chép toàn bộ tiêu chí và lựa chọn sang kỳ học hiện tại:</p>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="sourceTerm">Sao chép từ kỳ:</Form.Label>
            <Form.Select
              id="sourceTerm"
              value={sourceTerm}
              onChange={(e) => setSourceTerm(e.target.value)}
              disabled={isCopying || sourceTermOptions.length === 0}
            >
              <option value="">-- Chọn kỳ nguồn --</option>
              {sourceTermOptions.map(t => (
                <option key={t.code} value={t.code}>{t.title} ({t.code})</option>
              ))}
            </Form.Select>
            {sourceTermOptions.length === 0 && <Form.Text className="text-warning mt-1">Không có kỳ học nào khác để sao chép.</Form.Text>}
          </Form.Group>
          <Form.Group className="mb-1">
            <Form.Label>Sao chép đến kỳ:</Form.Label>
            <Form.Control type="text" value={currentTargetTerm} disabled />
          </Form.Group>
          <Alert variant="warning" className="small mt-3 mb-0">
            <i className="bi bi-exclamation-triangle-fill me-1"></i>
            <strong>Lưu ý:</strong> Hành động này sẽ thất bại nếu kỳ đích ({currentTargetTerm}) đã có sẵn tiêu chí.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="success"
            className="btn-main"
            onClick={handleCopyCriteria}
            disabled={isCopying || !sourceTerm || sourceTermOptions.length === 0}
          >
            {isCopying ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="bi bi-clipboard-plus me-1"></i>}
            Sao chép
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminCriteriaPage;