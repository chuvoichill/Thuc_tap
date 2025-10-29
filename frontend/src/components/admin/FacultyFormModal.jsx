import React, { useState, useEffect, useRef } from 'react';
import useNotify from '../../hooks/useNotify'; // Import hook for notifications

const FacultyFormModal = ({ facultyToEdit, onSave, onClose }) => {
  const { notify } = useNotify(); // Get notification function
  // State for form data (faculty code and name)
  const [formData, setFormData] = useState({ code: '', name: '' });
  const [isSaving, setIsSaving] = useState(false); // State to track saving status
  const modalRef = useRef(null); // Ref for the modal's DOM element
  const modalInstanceRef = useRef(null); // Ref for the Bootstrap modal instance
  const onCloseRef = useRef(onClose); // Dùng ref để lấy hàm onClose mới nhất

  // (Thêm useEffect này để cập nhật ref)
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Effect to populate the form when 'facultyToEdit' prop changes
  useEffect(() => {
    if (facultyToEdit) {
      // If editing, fill the form with existing faculty data
      setFormData({ code: facultyToEdit.code || '', name: facultyToEdit.name || '' });
    } else {
      // If adding new, reset the form
      setFormData({ code: '', name: '' });
    }
  }, [facultyToEdit]); // Rerun effect if facultyToEdit changes

  useEffect(() => {
    if (!modalRef.current) return;
    const modalEl = modalRef.current;
    const instance = new window.bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    modalInstanceRef.current = instance;
    instance.show();

    const handleHidden = () => {
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();
      
      try { if (instance) instance.dispose(); } catch (e) {}
      
      if (onCloseRef.current) onCloseRef.current();
    };
    modalEl.addEventListener('hidden.bs.modal', handleHidden);
    
    return () => {
      modalEl.removeEventListener('hidden.bs.modal', handleHidden);
      try {
          if (modalInstanceRef.current) modalInstanceRef.current.dispose();
          const backdrop = document.querySelector('.modal-backdrop');
          if (backdrop) backdrop.remove();
      } catch(e) {}
      modalInstanceRef.current = null;
    };
  }, []); // Mảng dependency RỖNG

  // Update form data state when input fields change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submission when the "Save" button is clicked
  const handleSave = async (e) => {
    e.preventDefault(); // Prevent default browser form submission
    setIsSaving(true); // Set saving state to true (disable buttons, show loading)
    try {
      // Call the onSave function (passed from ManageFacultiesPage)
      // with the current form data and the ID (if editing)
      await onSave(formData, facultyToEdit?.id);
      // If saving is successful, hide the modal
      if (modalInstanceRef.current) {
        modalInstanceRef.current.hide();
      }
    } catch (error) {
      // Error notification is handled by the parent component (ManageFacultiesPage)
      console.error("Save faculty failed in modal:", error);
    } finally {
      setIsSaving(false); // Reset saving state regardless of success or failure
    }
  };

  // Render the modal JSX
  return (
    <div className="modal fade" ref={modalRef} tabIndex="-1">
      <div className="modal-dialog"> {/* Standard modal size */}
        <div className="modal-content">
          <form onSubmit={handleSave}>
            <div className="modal-header">
              <h5 className="modal-title">{facultyToEdit ? 'Edit Faculty' : 'Add New Faculty'}</h5>
              {/* Close button (top right) */}
              <button type="button" className="btn-close" data-bs-dismiss="modal" disabled={isSaving}></button>
            </div>
            <div className="modal-body">
              {/* Faculty Code Input */}
              <div className="mb-3">
                <label htmlFor="code" className="form-label">Faculty Code *</label>
                <input
                  type="text"
                  className="form-control"
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  required // Make field mandatory
                  disabled={isSaving} // Disable input while saving
                  maxLength={10} // Optional length limit
                />
              </div>
              {/* Faculty Name Input */}
              <div className="mb-3">
                <label htmlFor="name" className="form-label">Faculty Name *</label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required // Make field mandatory
                  disabled={isSaving} // Disable input while saving
                />
              </div>
            </div>
            <div className="modal-footer">
              {/* Cancel button */}
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" disabled={isSaving}>Cancel</button>
              {/* Save button */}
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'} {/* Show loading text on button */}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FacultyFormModal; // Export the component