import React, { useState, useEffect, useRef } from 'react';
import useNotify from '../../hooks/useNotify';
import { getAllFacultiesSimple } from '../../services/drlService'; // API to get faculty list

const ClassFormModal = ({ classToEdit, onSave, onClose }) => {
  const { notify } = useNotify();
  // State for form data
  const [formData, setFormData] = useState({ code: '', name: '', faculty_id: '' });
  // State for faculty list (for dropdown)
  const [faculties, setFaculties] = useState([]);
  const [isLoadingFaculties, setIsLoadingFaculties] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Saving state
  const modalRef = useRef(null); // Ref for modal DOM element
  const modalInstanceRef = useRef(null); // Ref for Bootstrap modal instance
  const onCloseRef = useRef(onClose); // Dùng ref để lấy hàm onClose mới nhất

  // (Thêm useEffect này để cập nhật ref)
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Load faculties for the dropdown when the component mounts or when creating a new class
  useEffect(() => {
    const fetchFaculties = async () => {
      setIsLoadingFaculties(true);
      try {
        const data = await getAllFacultiesSimple(); // Fetch faculty list
        setFaculties(data || []);
        // Set default faculty_id if creating a new class and faculties loaded
        if (!classToEdit && data && data.length > 0) {
          setFormData(prev => ({ ...prev, faculty_id: data[0].id }));
        }
      } catch (error) {
        notify('Could not load faculty list: ' + error.message, 'danger');
      }
      setIsLoadingFaculties(false);
    };
    fetchFaculties();
  }, [notify, classToEdit]); // Rerun if classToEdit changes (to reset default on new)

  // Populate form if editing an existing class
  useEffect(() => {
    if (classToEdit) {
      setFormData({
        code: classToEdit.code || '',
        name: classToEdit.name || '',
        faculty_id: classToEdit.faculty_id || '', // Ensure faculty_id is populated
      });
    } else {
      // Reset form for new class (faculty_id is handled in the fetchFaculties effect)
      setFormData(prev => ({
           ...prev, // Keep potential default faculty_id
           code: '',
           name: '',
       }));
    }
  }, [classToEdit]);

  // Initialize and manage the Bootstrap modal instance
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
      } catch(e) {
           console.warn("Bootstrap dispose/backdrop error on unmount (ignored):", e);
      }
      modalInstanceRef.current = null;
    };
  }, []); // Mảng dependency RỖNG, chỉ chạy 1 lần

  // Update form data state on input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submission (Save button click)
  const handleSave = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setIsSaving(true);
    try {
      // Call the onSave function passed from the parent (ManageClassesPage)
      await onSave(formData, classToEdit?.id);
      // If save is successful, hide the modal
      if (modalInstanceRef.current) {
        modalInstanceRef.current.hide();
      }
    } catch (error) {
      // Error is already notified by the parent component
      console.error("Save class failed in modal:", error);
    } finally {
      setIsSaving(false); // End saving state
    }
  };

  return (
    <div className="modal fade" ref={modalRef} tabIndex="-1">
      <div className="modal-dialog">
        <div className="modal-content">
          <form onSubmit={handleSave}>
            <div className="modal-header">
              <h5 className="modal-title">{classToEdit ? 'Edit Class' : 'Add New Class'}</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" disabled={isSaving}></button>
            </div>
            <div className="modal-body">
              {/* Class Code Input */}
              <div className="mb-3">
                <label htmlFor="code" className="form-label">Class Code *</label>
                <input
                  type="text"
                  className="form-control"
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  disabled={isSaving} // Disable input while saving
                  maxLength={20} // Optional: Limit length
                />
              </div>
              {/* Class Name Input */}
              <div className="mb-3">
                <label htmlFor="name" className="form-label">Class Name *</label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isSaving}
                />
              </div>
              {/* Faculty Selection Dropdown */}
              <div className="mb-3">
                <label htmlFor="faculty_id" className="form-label">Faculty *</label>
                <select
                  className="form-select"
                  id="faculty_id"
                  name="faculty_id"
                  value={formData.faculty_id} // Use faculty_id here
                  onChange={handleChange}
                  required
                  disabled={isLoadingFaculties || isSaving} // Disable while loading or saving
                >
                  {isLoadingFaculties ? (
                    <option>Loading Faculties...</option>
                  ) : (
                    faculties.map(faculty => (
                      // Use faculty.id as the value for the option
                      <option key={faculty.id} value={faculty.id}>
                        {faculty.name} ({faculty.code})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" disabled={isSaving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isLoadingFaculties || isSaving}>
                {isSaving ? 'Saving...' : 'Save'} {/* Show loading text on button */}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClassFormModal;