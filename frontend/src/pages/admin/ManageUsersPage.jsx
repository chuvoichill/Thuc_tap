import React, { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Button, Badge } from 'react-bootstrap'; // Import components
import useNotify from '../../hooks/useNotify';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import UserFormModal from '../../components/admin/UserFormModal';
import { roleVN } from '../../utils/helpers';

const ManageUsersPage = () => {
  const { notify } = useNotify();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getAdminUsers();
      setUsers(data || []);
    } catch (e) { setError('Không tải được danh sách người dùng: ' + e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenModal = (user = null) => { setUserToEdit(user); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setUserToEdit(null); };

  const handleSaveUser = async (userData, userKey) => {
    try {
      if (userKey) {
        await updateAdminUser(userKey, userData);
        notify('Cập nhật người dùng thành công!');
      } else {
        await createAdminUser(userData);
        notify('Thêm người dùng thành công!');
      }
      fetchData();
      return Promise.resolve();
    } catch (e) {
      notify(`Lỗi khi lưu người dùng: ${e.message}`, 'danger');
      return Promise.reject(e);
    }
  };

  const handleDeleteUser = async (userKey, username) => {
    if (window.confirm(`Bạn có chắc muốn xóa người dùng "${username}"?`)) {
      try {
        await deleteAdminUser(userKey);
        notify('Xóa người dùng thành công!', 'info');
        fetchData();
      } catch (e) {
        notify(`Lỗi khi xóa người dùng: ${e.message}`, 'danger');
      }
    }
  };

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <Alert variant="danger">{error}</Alert>;
     if (users.length === 0) return <Alert variant="info">Chưa có người dùng nào.</Alert>;

    return (
      <Table striped responsive className="align-middle" size="sm">
          <thead>
            <tr>
              <th>Username</th>
              <th>Tên hiển thị</th>
              <th>Vai trò</th>
              <th>MSSV</th>
              <th>Khoa</th>
              <th>Trạng thái</th>
              <th className="text-end">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id || u.username}>
                <td>{u.username}</td>
                <td>{u.display_name}</td>
                <td>{roleVN(u.role_code)}</td>
                <td>{u.student_code || '-'}</td>
                <td>{u.faculty_code || '-'}</td>
                <td>
                  <Badge bg={u.is_active ? 'success' : 'secondary'}>{u.is_active ? 'Hoạt động' : 'Khóa'}</Badge>
                </td>
                <td className="text-end text-nowrap">
                  <Button size="sm" variant="outline-primary" className="me-1" onClick={() => handleOpenModal(u)}>
                    <i className="bi bi-pencil-square"></i> Sửa
                  </Button>
                  <Button size="sm" variant="outline-danger" onClick={() => handleDeleteUser(u.id || u.username, u.username)}>
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
          <i className='bi bi-people-fill me-2'></i> Quản lý Người dùng
        </div>
        <Button size="sm" variant="primary" onClick={() => handleOpenModal(null)}>
          <i className="bi bi-plus-lg me-1"></i> Thêm mới
        </Button>
      </div>

      {renderContent()}

      {showModal && (
        <UserFormModal
          userToEdit={userToEdit}
          onSave={handleSaveUser}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default ManageUsersPage;