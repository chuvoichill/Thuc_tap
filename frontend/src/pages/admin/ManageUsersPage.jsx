import React, { useState, useEffect, useCallback } from 'react';
import useNotify from '../../hooks/useNotify';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../services/drlService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import UserFormModal from '../../components/admin/UserFormModal'; // Import modal form
import { roleVN } from '../../utils/helpers'; // Để hiển thị tên role tiếng Việt

const ManageUsersPage = () => {
  const { notify } = useNotify();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null); // null: tạo mới, object: sửa

  // Tải danh sách users
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getAdminUsers(); // Có thể thêm filter/sort sau
      setUsers(data || []);
    } catch (e) { setError('Không tải được danh sách người dùng: ' + e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Mở modal
  const handleOpenModal = (user = null) => { setUserToEdit(user); setShowModal(true); };
  // Đóng modal
  const handleCloseModal = () => { setShowModal(false); setUserToEdit(null); };

  // Xử lý Lưu từ modal
  const handleSaveUser = async (userData, userKey) => { // userKey có thể là id hoặc username
    try {
      if (userKey) { // Update
        // Backend có thể dùng id hoặc username, đảm bảo API nhất quán
        await updateAdminUser(userKey, userData);
        notify('Cập nhật người dùng thành công!');
      } else { // Create
        await createAdminUser(userData);
        notify('Thêm người dùng thành công!');
      }
      fetchData(); // Tải lại danh sách
      return Promise.resolve(); // Báo thành công để modal tự đóng
    } catch (e) {
      notify(`Lỗi khi lưu người dùng: ${e.message}`, 'danger');
      return Promise.reject(e); // Báo lỗi để modal không đóng
    }
  };

  // Xử lý Xóa
  const handleDeleteUser = async (userKey, username) => {
    if (window.confirm(`Bạn có chắc muốn xóa người dùng "${username}"?`)) {
      try {
        await deleteAdminUser(userKey); // Backend có thể dùng id hoặc username
        notify('Xóa người dùng thành công!', 'info');
        fetchData(); // Tải lại danh sách
      } catch (e) {
        notify(`Lỗi khi xóa người dùng: ${e.message}`, 'danger');
      }
    }
  };

  const renderContent = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <div className="alert alert-danger">{error}</div>;
     if (users.length === 0) return <div className="alert alert-info">Chưa có người dùng nào.</div>;

    return (
      <div className="table-responsive">
        <table className="table table-striped align-middle table-sm">
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
              // Backend nên trả về id hoặc username làm key duy nhất
              <tr key={u.id || u.username}>
                <td>{u.username}</td>
                <td>{u.display_name}</td>
                <td>{roleVN(u.role_code)}</td>
                <td>{u.student_code || '-'}</td> {/* Hiển thị '-' nếu null */}
                <td>{u.faculty_code || '-'}</td> {/* Hiển thị '-' nếu null */}
                <td>
                  {u.is_active ? <span className="badge bg-success">Hoạt động</span> : <span className="badge bg-secondary">Khóa</span>}
                </td>
                <td className="text-end text-nowrap">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => handleOpenModal(u)}>
                    <i className="bi bi-pencil-square"></i> Sửa
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteUser(u.id || u.username, u.username)}>
                    <i className="bi bi-trash"></i> Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <div className='section-title mb-0'>
          <i className='bi bi-people-fill me-2'></i> Quản lý Người dùng
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => handleOpenModal(null)}>
          <i className="bi bi-plus-lg me-1"></i> Thêm mới
        </button>
      </div>

      {renderContent()}

      {/* Modal sẽ render khi showModal là true */}
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