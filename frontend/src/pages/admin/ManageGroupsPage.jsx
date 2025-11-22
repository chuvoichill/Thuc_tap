import React, { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Button } from 'react-bootstrap'; // Import components
import { useTerm } from '../../layout/DashboardLayout';
import useNotify from '../../hooks/useNotify';
import { getAdminGroups, createAdminGroup, updateAdminGroup, deleteAdminGroup } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import GroupFormModal from '../../components/admin/GroupFormModal';

const ManageGroupsPage = () => {
  const { term } = useTerm();
  const { notify } = useNotify();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState(null);

  const fetchData = useCallback(async () => {
    if (!term) return;
    setLoading(true); setError(null);
    try {
      const data = await getAdminGroups(term);
      setGroups(data || []);
    } catch (e) { setError('Lỗi tải Nhóm: ' + e.message); }
    setLoading(false);
  }, [term]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenModal = (grp = null) => { setGroupToEdit(grp); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setGroupToEdit(null); };

  const handleSaveGroup = async (groupData, groupId) => {
    try {
      if (groupId) {
        await updateAdminGroup(groupId, groupData);
        notify('Cập nhật Nhóm thành công!');
      } else {
        await createAdminGroup(groupData);
        notify('Thêm Nhóm thành công!');
      }
      fetchData(); return Promise.resolve();
    } catch (e) { notify(`Lỗi: ${e.message}`, 'danger'); return Promise.reject(e); }
  };

  const handleDeleteGroup = async (groupId, groupCode) => {
    if (window.confirm(`Xóa Nhóm "${groupCode}" của kỳ ${term}?`)) {
      try {
        await deleteAdminGroup(groupId);
        notify('Xóa Nhóm thành công!', 'info');
        fetchData();
      } catch (e) {
         notify(`Lỗi xóa: ${e.message}`, 'danger');
      }
    }
  };

  const renderContent = () => {
      if (loading) return <LoadingSpinner />;
      if (error) return <Alert variant="danger">{error}</Alert>;
      if (groups.length === 0) return <Alert variant="info">Chưa có Nhóm TC nào cho kỳ này.</Alert>;
      return (
        <Table striped responsive className="align-middle" size="sm">
          <thead><tr><th>Mã Nhóm</th><th>Tên Nhóm</th><th className="text-end">Thao tác</th></tr></thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id}>
                  <td>{g.code}</td><td>{g.title}</td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="outline-primary" className="me-1" onClick={() => handleOpenModal(g)}>
                      <i className="bi bi-pencil-square"></i> Sửa
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => handleDeleteGroup(g.id, g.code)}>
                       <i className="bi bi-trash"></i> Xóa
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
        </Table>
      );
  };

  return (
    <>
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <div className='section-title mb-0'>
          <i className='bi bi-tags-fill me-2'></i> Quản lý Nhóm Tiêu chí – Kỳ <b>{term}</b>
        </div>
        <Button size="sm" className="btn-main" variant='success' onClick={() => handleOpenModal(null)}>
          <i className="bi bi-plus-lg me-1"></i> Thêm mới
        </Button>
      </div>
      {renderContent()}
      {showModal && (
        <GroupFormModal
          groupToEdit={groupToEdit}
          termCode={term}
          onSave={handleSaveGroup}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};
export default ManageGroupsPage;