import React, { useState, useEffect, useRef, useCallback } from 'react';
import useNotify from '../../hooks/useNotify';
import { getAdminGroups, updateAdminGroup } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';

const ManageGroupsModal = ({ term, onClose, onGroupsUpdated }) => {
    const { notify } = useNotify();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingStates, setSavingStates] = useState({}); // { [groupId]: boolean }
    const [error, setError] = useState(null);
    const modalRef = useRef(null);
    const modalInstanceRef = useRef(null);
    const onCloseRef = useRef(onClose);


    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    // Hàm tải danh sách nhóm
    const fetchData = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const data = await getAdminGroups(term);
            // Khởi tạo state nội bộ để sửa đổi
            setGroups(data.map(g => ({ ...g, editTitle: g.title, editCode: g.code })));
        } catch (e) { setError("Lỗi tải danh sách nhóm: " + e.message); }
        setLoading(false);
    }, [term]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Khởi tạo modal
    useEffect(() => {
        if (!modalRef.current) return;
        const modalEl = modalRef.current;
        // Dùng keyboard: false để tránh lỗi khi backdrop bị kẹt
        const instance = new window.bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
        modalInstanceRef.current = instance;
        instance.show();

        // Listener QUAN TRỌNG: Chạy KHI modal đã ẩn hoàn toàn
        const handleHidden = () => {
            // 1. DỌN DẸP THỦ CÔNG BACKDROP (Rất quan trọng)
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }

            // 2. Gọi dispose()
            try {
                if (instance) {
                    instance.dispose();
                }
            } catch (e) {
                console.warn("Bootstrap dispose error (ignored):", e);
            }

            // 3. Gọi hàm onClose (từ props) qua ref
            if (onCloseRef.current) {
                onCloseRef.current();
            }
        };
        modalEl.addEventListener('hidden.bs.modal', handleHidden); // Gắn listener

        // Hàm dọn dẹp khi component unmount (phòng hờ)
        return () => {
            modalEl.removeEventListener('hidden.bs.modal', handleHidden);
            try {
                if (modalInstanceRef.current) {
                    modalInstanceRef.current.dispose();
                }
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
            } catch (e) {
                console.warn("Bootstrap dispose/backdrop error on unmount (ignored):", e);
            }
            modalInstanceRef.current = null;
        };
    }, []); // Mảng dependency RỖNG, chỉ chạy 1 lần

    // Cập nhật state nội bộ khi sửa input
    const handleInputChange = (groupId, field, value) => {
        setGroups(prev => prev.map(g =>
            g.id === groupId ? { ...g, [field]: value } : g
        ));
    };

    // Lưu thay đổi cho một nhóm
    const handleSaveGroup = async (group) => {
        // Chỉ lưu nếu có thay đổi
        if (group.editTitle === group.title && group.editCode === group.code) {
            return;
        }
        setSavingStates(prev => ({ ...prev, [group.id]: true }));
        try {
            // Dữ liệu gửi đi chỉ chứa các trường được phép sửa
            const dataToUpdate = {};
            if (group.editTitle !== group.title) dataToUpdate.title = group.editTitle;
            if (group.editCode !== group.code) dataToUpdate.code = group.editCode; // Cho phép sửa code (nếu cần)

            const updatedGroup = await updateAdminGroup(group.id, dataToUpdate);
            // Cập nhật lại state gốc (không phải state edit)
            setGroups(prev => prev.map(g =>
                g.id === group.id ? { ...g, title: updatedGroup.title, code: updatedGroup.code, editTitle: updatedGroup.title, editCode: updatedGroup.code } : g
            ));
            notify(`Đã cập nhật nhóm "${updatedGroup.code}"`, 'success');
        } catch (e) {
            notify(`Lỗi cập nhật nhóm ${group.code}: ${e.message}`, 'danger');
            // Reset về giá trị cũ nếu lỗi
            setGroups(prev => prev.map(g =>
                g.id === group.id ? { ...g, editTitle: g.title, editCode: g.code } : g
            ));
        } finally {
            setSavingStates(prev => ({ ...prev, [group.id]: false }));
        }
    };

    // Xử lý khi bấm nút "Lưu tất cả & Đóng"
    const handleSaveAllAndClose = async () => {
        let success = true;
        // Lặp qua các nhóm có thay đổi để lưu
        for (const group of groups) {
            if (group.editTitle !== group.title || group.editCode !== group.code) {
                await handleSaveGroup(group).catch(() => success = false); // Lưu từng nhóm, đánh dấu nếu có lỗi
            }
        }
        if (success) {
            if (onGroupsUpdated) onGroupsUpdated(); // Báo cho cha biết đã cập nhật
            if (modalInstanceRef.current) modalInstanceRef.current.hide(); // Đóng modal nếu thành công
        } else {
            notify("Có lỗi xảy ra, vui lòng kiểm tra lại.", "warning");
        }
    };


    return (
        <div className="modal fade show d-block" ref={modalRef} tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg modal-dialog-scrollable"> {/* modal-lg */}
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Quản lý Tên Nhóm Tiêu chí - Kỳ {term}</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div className="modal-body">
                        {loading && <LoadingSpinner />}
                        {error && <div className="alert alert-danger">{error}</div>}
                        {!loading && !error && (
                            groups.length === 0 ? (
                                <div className='text-center text-muted p-3'>
                                    Kỳ này chưa có nhóm tiêu chí nào được tạo. <br />
                                    Nhóm sẽ được tự động tạo khi bạn lưu tiêu chí đầu tiên cho nhóm đó.
                                    {/* Optional: Button to add default groups */}
                                    {/* <button className='btn btn-sm btn-outline-primary mt-2'>Tạo nhóm mặc định (1-10)</button> */}
                                </div>
                            ) : (
                                <table className='table table-sm table-bordered'>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '80px' }}>Mã Nhóm</th>
                                            <th>Tên Nhóm (Tiêu đề)</th>
                                            <th style={{ width: '100px' }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groups.map(g => {
                                            const isSaving = savingStates[g.id];
                                            const hasChanged = g.editTitle !== g.title || g.editCode !== g.code;
                                            return (
                                                <tr key={g.id}>
                                                    <td>
                                                        {/* Cho phép sửa code (nếu muốn) */}
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm"
                                                            value={g.editCode || ''}
                                                            onChange={e => handleInputChange(g.id, 'editCode', e.target.value)}
                                                            disabled={isSaving}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm"
                                                            value={g.editTitle || ''}
                                                            onChange={e => handleInputChange(g.id, 'editTitle', e.target.value)}
                                                            disabled={isSaving}
                                                            required
                                                        />
                                                    </td>
                                                    <td className='text-center'>
                                                        <button
                                                            className='btn btn-sm btn-success'
                                                            onClick={() => handleSaveGroup(g)}
                                                            disabled={isSaving || !hasChanged} // Disable nếu đang lưu hoặc chưa đổi
                                                        >
                                                            {isSaving ? <span className="spinner-border spinner-border-sm"></span> : <i className="bi bi-save"></i>}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
                        {/* Nút lưu tất cả thay đổi và đóng */}
                        <button type="button" className="btn btn-primary" onClick={handleSaveAllAndClose} disabled={loading || Object.values(savingStates).some(s => s)}>
                            Lưu tất cả & Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageGroupsModal;