import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Table, Form, Alert, Spinner } from 'react-bootstrap'; // Import components
import useNotify from '../../hooks/useNotify';
import { getAdminGroups, updateAdminGroup } from '../../services/drlService';
import LoadingSpinner from '../common/LoadingSpinner';

const ManageGroupsModal = ({ term, onClose, onGroupsUpdated }) => {
    const { notify } = useNotify();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingStates, setSavingStates] = useState({});
    const [error, setError] = useState(null);
    const [show, setShow] = useState(true); // State để React-Bootstrap quản lý Modal

    // Hàm xử lý đóng Modal
    const handleClose = () => setShow(false);
    const handleExited = () => onClose();

    // Hàm tải danh sách nhóm
    const fetchData = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const data = await getAdminGroups(term);
            setGroups(data.map(g => ({ ...g, editTitle: g.title, editCode: g.code })));
        } catch (e) { setError("Lỗi tải danh sách nhóm: " + e.message); }
        setLoading(false);
    }, [term]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Cập nhật state nội bộ khi sửa input
    const handleInputChange = (groupId, field, value) => {
        setGroups(prev => prev.map(g =>
            g.id === groupId ? { ...g, [field]: value } : g
        ));
    };

    // Lưu thay đổi cho một nhóm
    const handleSaveGroup = async (group) => {
        if (group.editTitle === group.title && group.editCode === group.code) {
            return;
        }
        setSavingStates(prev => ({ ...prev, [group.id]: true }));
        try {
            const dataToUpdate = {};
            if (group.editTitle !== group.title) dataToUpdate.title = group.editTitle;
            if (group.editCode !== group.code) dataToUpdate.code = group.editCode;

            const updatedGroup = await updateAdminGroup(group.id, dataToUpdate);
            setGroups(prev => prev.map(g =>
                g.id === group.id ? { ...g, title: updatedGroup.title, code: updatedGroup.code, editTitle: updatedGroup.title, editCode: updatedGroup.code } : g
            ));
            notify(`Đã cập nhật nhóm "${updatedGroup.code}"`, 'success');
        } catch (e) {
            notify(`Lỗi cập nhật nhóm ${group.code}: ${e.message}`, 'danger');
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
        // Tạm thời disable nút Đóng khi đang lưu
        for (const group of groups) {
            if (group.editTitle !== group.title || group.editCode !== group.code) {
                // Xử lý lỗi trong catch của handleSaveGroup
                await handleSaveGroup(group).catch(() => success = false); 
            }
        }
        if (success) {
            if (onGroupsUpdated) onGroupsUpdated();
            handleClose(); // Đóng modal
        } else {
            notify("Có lỗi xảy ra, vui lòng kiểm tra lại.", "warning");
        }
    };


    return (
        <Modal 
            show={show} 
            onHide={handleClose} 
            onExited={handleExited} 
            backdrop="static" 
            keyboard={false}
            size="lg" // Thay thế modal-lg
            scrollable // Thay thế modal-dialog-scrollable
        >
            <Modal.Header closeButton>
                <Modal.Title>Quản lý Tên Nhóm Tiêu chí - Kỳ {term}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {loading && <LoadingSpinner />}
                {error && <Alert variant="danger">{error}</Alert>}
                {!loading && !error && (
                    groups.length === 0 ? (
                        <div className='text-center text-muted p-3'>
                            Kỳ này chưa có nhóm tiêu chí nào được tạo. <br />
                            Nhóm sẽ được tự động tạo khi bạn lưu tiêu chí đầu tiên cho nhóm đó.
                        </div>
                    ) : (
                        <Table responsive striped bordered size="sm"> {/* table-sm */}
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
                                                {/* Dùng Form.Control size="sm" */}
                                                <Form.Control
                                                    type="text"
                                                    size="sm"
                                                    value={g.editCode || ''}
                                                    onChange={e => handleInputChange(g.id, 'editCode', e.target.value)}
                                                    disabled={isSaving}
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="text"
                                                    size="sm"
                                                    value={g.editTitle || ''}
                                                    onChange={e => handleInputChange(g.id, 'editTitle', e.target.value)}
                                                    disabled={isSaving}
                                                    required
                                                />
                                            </td>
                                            <td className='text-center'>
                                                <Button
                                                    variant="success"
                                                    size="sm"
                                                    onClick={() => handleSaveGroup(g)}
                                                    disabled={isSaving || !hasChanged}
                                                >
                                                    {isSaving ? <Spinner animation="border" size="sm" /> : <i className="bi bi-save"></i>}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    )
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>Đóng</Button>
                <Button 
                    variant="primary" 
                    onClick={handleSaveAllAndClose} 
                    disabled={loading || Object.values(savingStates).some(s => s)}
                >
                    Lưu tất cả & Đóng
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ManageGroupsModal;