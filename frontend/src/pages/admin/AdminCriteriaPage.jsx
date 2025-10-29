import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTerm } from '../../layout/DashboardLayout'; // Hook lấy kỳ học hiện tại
import useNotify from '../../hooks/useNotify'; // Hook hiển thị thông báo
import {
   getAdminGroups, // Bỏ import này nếu không dùng nữa
  getCriteria,
  createCriterion,
  updateCriterion,
  deleteCriterion,
  updateCriterionOptions,
  getTerms,
  copyCriteriaFromTerm
} from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner'; // Component loading

// Template dữ liệu cho tiêu chí mới
const newCriterionTemplate = {
  id: null, code: '', title: '', type: 'radio',
  max_points: 0, display_order: 999, options: []
};




const AdminCriteriaPage = () => {
  const { term: currentTargetTerm } = useTerm(); // Lấy kỳ học đang được chọn từ layout
  const { notify } = useNotify(); // Lấy hàm hiển thị thông báo

  // --- State quản lý dữ liệu ---
  const [groups, setGroups] = useState([]); // Bỏ state groups
  const [allCriteria, setAllCriteria] = useState([]); // Danh sách tiêu chí cho kỳ hiện tại
  const [loading, setLoading] = useState(true); // Trạng thái tải dữ liệu chính
  const [error, setError] = useState(null); // Lỗi tải dữ liệu

  // --- State quản lý giao diện ---
  const [filterGroup, setFilterGroup] = useState(''); // Nhóm được chọn trong bộ lọc danh sách
  const [currentCriterion, setCurrentCriterion] = useState(null); // Tiêu chí đang được chọn để sửa/xem
  const [isSaving, setIsSaving] = useState(false); // Trạng thái đang lưu tiêu chí

  const copyModalRef = useRef(null); // Ref cho DOM
  const copyModalInstanceRef = useRef(null); // Ref cho instance Bootstrap

  // --- State cho chức năng sao chép ---
  const [showCopyModal, setShowCopyModal] = useState(false); // Hiển thị/ẩn modal sao chép
  const [allTerms, setAllTerms] = useState([]); // Danh sách tất cả các kỳ học
  const [sourceTerm, setSourceTerm] = useState(''); // Kỳ học nguồn được chọn để sao chép
  const [isCopying, setIsCopying] = useState(false); // Trạng thái đang thực hiện sao chép

  

  // --- Hàm tải dữ liệu chính (tiêu chí, danh sách kỳ) ---
  const fetchData = useCallback(async () => {
    if (!currentTargetTerm) return; // Không tải nếu chưa có kỳ học
    setLoading(true);
    setError(null);
    setCurrentCriterion(null); // Bỏ chọn tiêu chí khi đổi kỳ
    setFilterGroup(''); // Reset bộ lọc nhóm khi đổi kỳ
    try {
      // Gọi đồng thời các API cần thiết
      const [criteriaData, termsData, groupsData] = await Promise.all([ // <--- THÊM groupsData
        getCriteria(currentTargetTerm),
        getTerms({ sortBy: 'year_desc,semester_desc' }),
        getAdminGroups(currentTargetTerm) // <--- THÊM API CALL NÀY
      ]);

      setGroups(groupsData || []); // Bỏ dòng này
      setAllCriteria(criteriaData || []); // Lưu danh sách tiêu chí
      setAllTerms(termsData || []); // Lưu danh sách tất cả kỳ học

      // Tự động chọn kỳ học nguồn mặc định cho chức năng sao chép
      const currentTermIndex = (termsData || []).findIndex(t => t.code === currentTargetTerm);
      if (currentTermIndex >= 0 && currentTermIndex + 1 < termsData.length) {
         setSourceTerm(termsData[currentTermIndex + 1]?.code || ''); // Lấy kỳ trước đó
      } else if (termsData?.length > 1) {
          setSourceTerm(termsData.find(t => t.code !== currentTargetTerm)?.code || '');
      } else {
          setSourceTerm(''); // Không có kỳ nào khác
      }

    } catch (e) {
      setError('Lỗi tải dữ liệu Quản trị Tiêu chí: ' + e.message); // Báo lỗi
    }
    setLoading(false); // Kết thúc tải
  }, [currentTargetTerm]); // Chạy lại khi kỳ học hiện tại thay đổi

  // Gọi fetchData khi component mount hoặc fetchData thay đổi
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- THÊM MỚI: useEffect ĐỂ QUẢN LÝ MODAL SAO CHÉP ---
  useEffect(() => {
    if (showCopyModal) {
      // Nếu state là true và chưa có instance, tạo mới
      if (copyModalRef.current && !copyModalInstanceRef.current) {
        const instance = new window.bootstrap.Modal(copyModalRef.current, {
          backdrop: 'static',
          keyboard: false,
        });
        copyModalInstanceRef.current = instance;

        const handleHidden = () => {
          // 1. DỌN DẸP BACKDROP
          const backdrop = document.querySelector('.modal-backdrop');
          if (backdrop) backdrop.remove();
          
          // 2. HỦY INSTANCE
          try {
            if (copyModalInstanceRef.current) {
              copyModalInstanceRef.current.dispose();
            }
          } catch (e) { /* Bỏ qua lỗi */ }
          
          copyModalInstanceRef.current = null;
          // 3. CẬP NHẬT STATE REACT
          setShowCopyModal(false); 
        };
        copyModalRef.current.addEventListener('hidden.bs.modal', handleHidden);

        instance.show();
      }
    } else {
      // Nếu state là false và đang có instance, gọi hide()
      if (copyModalInstanceRef.current) {
        copyModalInstanceRef.current.hide();
      }
    }

    // Dọn dẹp khi unmount
    return () => {
      try {
        if (copyModalInstanceRef.current) {
          copyModalInstanceRef.current.dispose();
          copyModalInstanceRef.current = null;
        }
      } catch (e) { /* Bỏ qua lỗi */ }
      
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();
    };
  }, [showCopyModal]); // Chạy lại khi showCopyModal thay đổi

  // --- Lọc danh sách tiêu chí hiển thị bên trái ---
  const filteredCriteria = useMemo(() => {
    if (!filterGroup) {
      return allCriteria.filter(c => String(c.code || '').includes('.'));
    }
    return allCriteria.filter(c => String(c.code || '').startsWith(`${filterGroup}.`));
  }, [allCriteria, filterGroup]);

  // --- Chọn một tiêu chí từ danh sách để sửa ---
  const selectCriterion = (crit) => {
    setCurrentCriterion(JSON.parse(JSON.stringify(crit)));
  };

  // --- Cập nhật state của form khi người dùng nhập liệu ---
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let val = value;
    if (name === 'max_points' || name === 'display_order' || name === 'group_no') {
      val = Number(value) || 0;
    }
    if (name === 'code') {
      updateOrderFromCode(value);
    }
    setCurrentCriterion(prev => ({ ...prev, [name]: val }));
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
      const parts = String(c.code||'').split('.');
      const critGroupNo = Number(parts[0]?.replace(/\D/g, '')) || 0;
      if (critGroupNo === gno) {
        const sub = Number(parts[parts.length - 1]?.replace(/\D/g,'')) || 0;
        if (sub > maxSub) maxSub = sub;
      }
    });
    const newCode = `${gno}.${maxSub + 1}`;
    setCurrentCriterion(prev => ({ ...prev, code: newCode, group_no: gno }));
    updateOrderFromCode(newCode);
  };

  // --- Xử lý khi bấm nút "Thêm tiêu chí" ---
  const handleNew = () => {
    // Lấy group_no từ filter, hoặc nhóm ĐẦU TIÊN trong state
    const gno = Number(filterGroup || groups[0]?.code || 1); 
    setCurrentCriterion({
      ...newCriterionTemplate,
      group_no: gno,
      term_code: currentTargetTerm,
      options: [{ id: null, label: '', score: 0, display_order: 1 }]
    });
    setTimeout(() => suggestNextCode(), 0);
  };

  // --- Xử lý thay đổi trong bảng Options ---
  const handleOptChange = (index, field, value) => {
    const newOptions = [...(currentCriterion.options || [])];
    newOptions[index] = {
      ...newOptions[index],
      [field]: (field === 'score' || field === 'display_order') ? (Number(value) || 0) : value
    };
    setCurrentCriterion(prev => ({ ...prev, options: newOptions }));
  };

  // --- Thêm một dòng option mới ---
  const addOptRow = () => {
    const newOpt = {
      id: null, label: '', score: 0,
      display_order: (currentCriterion.options?.length || 0) + 1
    };
    setCurrentCriterion(prev => ({ ...prev, options: [...(prev.options || []), newOpt] }));
  };

  // --- Xóa một dòng option ---
  const delOptRow = (index) => {
    setCurrentCriterion(prev => ({ ...prev, options: (prev.options || []).filter((_, i) => i !== index) }));
  };

  // --- Xử lý Lưu tiêu chí (tạo mới hoặc cập nhật) ---
  const handleSave = async () => {
     if (!currentCriterion || !currentCriterion.code || !currentCriterion.title || !currentCriterion.group_no) {
       notify('Vui lòng nhập Mã, Tiêu đề và chọn Nhóm.', 'warning');
       return;
     }
     setIsSaving(true);
     try {
       const { id, options, ...dataToSave } = currentCriterion;

       let savedCriterion;
       if (id) { savedCriterion = await updateCriterion(id, dataToSave); }
       else { savedCriterion = await createCriterion(dataToSave); }

       if (savedCriterion.type === 'radio') {
         const validOptions = (options || []).filter(opt => opt.label?.trim());
         await updateCriterionOptions(savedCriterion.id, validOptions);
       }
       notify('Đã lưu tiêu chí!', 'success');
       await fetchData();
       const freshData = await getCriteria(currentTargetTerm);
       const newlySaved = freshData.find(c => c.id === savedCriterion.id);
       if (newlySaved) { selectCriterion(newlySaved); }
       else { setCurrentCriterion(null); }

     } catch (e) { notify('Lỗi khi lưu: ' + e.message, 'danger'); }
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
       setShowCopyModal(false);
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
  if (error) return <div className="alert alert-danger">Lỗi tải dữ liệu: {error}</div>;

  const sourceTermOptions = allTerms.filter(t => t.code !== currentTargetTerm);

  return (
    <>
      {/* Tiêu đề trang và nút Sao chép */}
      <div className="d-flex justify-content-between align-items-center mb-3">
         <div className="section-title mb-0"><i className="bi bi-sliders2 me-2"></i>
           QUẢN TRỊ TIÊU CHÍ – Kỳ <b>{currentTargetTerm}</b>
         </div>
         <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setShowCopyModal(true)}
            disabled={loading}
        >
             <i className="bi bi-clipboard-plus me-1"></i> Sao chép từ kỳ trước...
         </button>
      </div>

      {/* Layout 2 cột */}
      <div className="row g-3">
        {/* Cột trái: Danh sách tiêu chí */}
        <div className="col-lg-5">
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between">
              <span>Danh sách tiêu chí</span>
              {/* Dropdown lọc theo nhóm */}
              <div className="d-flex align-items-center gap-2">
                <label className="small text-muted mb-0">Nhóm:</label>
                <select
                  className="form-select form-select-sm"
                  style={{minWidth:'200px'}}
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                >
                  <option value="">Tất cả nhóm</option>
                  {/* Tạo 10 option cố định */}
                  {groups.map(g => (
                    <option key={g.id || g.code} value={g.code}>{g.title} (Nhóm {g.code})</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Bảng danh sách tiêu chí */}
            <div className="card-body p-0">
              <div className="table-responsive" style={{ maxHeight: '62vh' }}>
                <table className="table table-hover table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Mã</th>
                      <th>Tiêu đề</th>
                      <th className="text-end" style={{ width: '60px' }}>Điểm</th>
                    </tr>
                  </thead>
                  <tbody>{/* No whitespace */}
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
                  </tbody>{/* No whitespace */}
                </table>
              </div>
            </div>
            {/* Nút thêm mới */}
            <div className="card-footer text-end">
              <button className="btn btn-sm btn-primary" onClick={handleNew}>
                <i className="bi bi-plus-lg me-1"></i>Thêm tiêu chí
              </button>
            </div>
          </div>
        </div>

        {/* Cột phải: Form chi tiết tiêu chí */}
        <div className="col-lg-7">
          {currentCriterion ? (
            <div className="card">
              <div className="card-header">
                {currentCriterion.id ? `Chi tiết: ${currentCriterion.code}` : 'Thêm tiêu chí mới'}
              </div>
              <div className="card-body">
                {/* Form tiêu chí */}
                <form className="mb-3" onSubmit={(e) => e.preventDefault()}>
                  <div className="row g-2">
                    {/* Chọn nhóm */}
                    <div className="col-md-6">
                      <label className="form-label form-label-sm">Nhóm tiêu chí *</label>
                      <select
                        name="group_no"
                        className="form-select form-select-sm"
                        value={currentCriterion.group_no || ''}
                        onChange={handleFormChange}
                        required
                      >
                         <option value="">-- Chọn nhóm --</option>
                         {groups.map(g => (
                           <option key={g.id || g.code} value={g.code}>{g.title} (Nhóm {g.code})</option>
                         ))}
                      </select>
                    </div>
                    {/* Mã tiêu chí */}
                    <div className="col-md-6">
                        <label className="form-label form-label-sm">Mã tiêu chí *</label>
                        <div className="input-group input-group-sm">
                            <input
                                name="code"
                                className="form-control"
                                placeholder="vd: 1.1"
                                value={currentCriterion.code || ''}
                                onChange={handleFormChange}
                                required
                            />
                            <button className="btn btn-outline-secondary" type="button" onClick={suggestNextCode}>Gợi ý</button>
                        </div>
                    </div>
                    {/* --- SỬA TIÊU ĐỀ THÀNH TEXTAREA --- */}
                    <div className="col-12">
                      <label className="form-label form-label-sm">Tiêu đề *</label>
                      {/* Thay <input> bằng <textarea> */}
                      <textarea
                        name="title"
                        className="form-control form-control-sm" // form-control-sm
                        placeholder="Nội dung tiêu chí"
                        value={currentCriterion.title || ''}
                        onChange={handleFormChange}
                        required
                        rows="3" // Đặt số dòng mặc định cho textarea
                      ></textarea>
                    </div>
                    {/* --- HẾT SỬA --- */}

                    {/* Loại tiêu chí */}
                    <div className="col-md-4">
                      <label className="form-label form-label-sm">Loại</label>
                      <select
                        name="type"
                        className="form-select form-select-sm"
                        value={currentCriterion.type || 'radio'}
                        onChange={(e) => {
                           handleFormChange(e);
                           if (e.target.value === 'radio' && (!currentCriterion.options || currentCriterion.options.length === 0)) { addOptRow(); }
                        }}
                      >
                        {/* --- XÓA OPTION "TỰ ĐỘNG" --- */}
                        <option value="radio">Radio (Lựa chọn)</option>
                        <option value="text">Text (Nhập liệu)</option>
                        {/* <option value="auto">Tự động (Hệ thống)</option> */}
                        {/* --- HẾT XÓA --- */}
                      </select>
                    </div>
                    {/* Điểm tối đa */}
                    <div className="col-md-4">
                         <label className="form-label form-label-sm">Điểm tối đa</label>
                         <input
                             name="max_points"
                             type="number"
                             min="0" step="1"
                             className="form-control form-control-sm"
                             value={currentCriterion.max_points || 0}
                             onChange={handleFormChange}
                         />
                    </div>
                    {/* Thứ tự */}
                    <div className="col-md-4">
                        <label className="form-label form-label-sm">Thứ tự</label>
                        <input
                            name="display_order"
                            type="number"
                            min="1" step="1"
                            className="form-control form-control-sm"
                            value={currentCriterion.display_order || 999}
                            onChange={handleFormChange}
                        />
                    </div>
                  </div>
                </form>

                {/* Form Options */}
                {currentCriterion.type === 'radio' && (
                  <div className='mt-3'>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="fw-semibold small">Các lựa chọn</div>
                      <button className="btn btn-sm btn-outline-primary" type="button" onClick={addOptRow}>
                        <i className="bi bi-plus-lg me-1"></i>Thêm
                      </button>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th style={{width:'60px'}}>TT</th>
                            <th>Nhãn hiển thị *</th>
                            <th style={{width:'90px'}} className="text-end">Điểm *</th>
                            <th style={{width:'50px'}}></th>
                          </tr>
                        </thead>
                        <tbody>{/* No whitespace */}
                          {(currentCriterion.options || []).map((opt, i) => (
                            <tr key={opt.id || i}>
                              <td><input type="number" min="1" step="1" className="form-control form-control-sm" value={opt.display_order || (i+1)} onChange={(e) => handleOptChange(i, 'display_order', e.target.value)}/></td>
                              <td><input type="text" className="form-control form-control-sm" placeholder='Nội dung lựa chọn' value={opt.label || ''} onChange={(e) => handleOptChange(i, 'label', e.target.value)} required/></td>
                              <td><input type="number" step="1" className="form-control form-control-sm text-end" value={opt.score === undefined ? '' : opt.score} onChange={(e) => handleOptChange(i, 'score', e.target.value)} required/></td>
                              <td>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => delOptRow(i)}>
                                  <i className="bi bi-x-lg"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                           {(!currentCriterion.options || currentCriterion.options.length === 0) && (
                              <tr><td colSpan="4" className="text-center text-muted small py-2">Chưa có lựa chọn nào. Bấm "Thêm" để tạo.</td></tr>
                           )}
                        </tbody>{/* No whitespace */}
                      </table>
                    </div>
                  </div>
                )}
              </div>
              {/* Footer Lưu/Xóa */}
              <div className="card-footer d-flex gap-2 justify-content-end">
                {currentCriterion.id && (
                  <button className="btn btn-danger btn-sm" type="button" disabled={isSaving} onClick={handleDelete}>
                    <i className="bi bi-trash me-1"></i>Xoá
                  </button>
                )}
                <button className="btn btn-primary btn-sm" type="button" disabled={isSaving} onClick={handleSave}>
                  {isSaving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-save me-1"></i>}
                  Lưu Tiêu chí
                </button>
              </div>
            </div>
          ) : (
            // Hướng dẫn khi chưa chọn
            <div className="card">
              <div className="card-body text-center text-muted p-5">
                <i className="bi bi-pencil-square fs-3"></i>
                <p className="mt-2">Hãy chọn một tiêu chí từ danh sách bên trái để xem/sửa chi tiết, hoặc bấm "Thêm tiêu chí" để tạo mới.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Sao chép (Được quản lý bởi useEffect) */}
      <div 
        className="modal fade" 
        ref={copyModalRef} // <-- Gắn ref
        tabIndex="-1"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Sao chép Tiêu chí</h5>
              {/* Sửa onClick: gọi hide() thay vì setShowCopyModal */}
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => copyModalInstanceRef.current?.hide()} // <-- Sửa
                disabled={isCopying}
              ></button>
            </div>
            <div className="modal-body">
              <p>Chọn kỳ học nguồn để sao chép toàn bộ tiêu chí và lựa chọn sang kỳ học hiện tại:</p>
              {/* ... (Nội dung dropdown và input giữ nguyên) ... */}
              <div className="mb-3">
                <label htmlFor="sourceTerm" className="form-label">Sao chép từ kỳ:</label>
                <select
                  id="sourceTerm"
                  className="form-select"
                  value={sourceTerm}
                  onChange={(e) => setSourceTerm(e.target.value)}
                  disabled={isCopying || sourceTermOptions.length === 0}
                >
                  <option value="">-- Chọn kỳ nguồn --</option>
                  {sourceTermOptions.map(t => (
                    <option key={t.code} value={t.code}>{t.title} ({t.code})</option>
                  ))}
                </select>
                {sourceTermOptions.length === 0 && <div className="form-text text-warning mt-1">Không có kỳ học nào khác để sao chép.</div>}
              </div>
              <div className="mb-1">
                <label className="form-label">Sao chép đến kỳ:</label>
                <input type="text" className="form-control" value={currentTargetTerm} disabled />
              </div>
              <div className="alert alert-warning small mt-3 mb-0">
                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                <strong>Lưu ý:</strong> Hành động này sẽ thất bại nếu kỳ đích ({currentTargetTerm}) đã có sẵn tiêu chí.
              </div>
            </div>
            <div className="modal-footer">
              {/* Sửa onClick: gọi hide() thay vì setShowCopyModal */}
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => copyModalInstanceRef.current?.hide()} // <-- Sửa
                disabled={isCopying}
              >Hủy</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCopyCriteria}
                disabled={isCopying || !sourceTerm || sourceTermOptions.length === 0}
              >
                {isCopying ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-clipboard-plus me-1"></i>}
                Sao chép
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* --- HẾT THAY THẾ --- */}
    </>
  );
};

export default AdminCriteriaPage;