import React from 'react';
import { Spinner } from 'react-bootstrap'; // Import Spinner component

const LoadingSpinner = () => {
  return (
    <div className="text-center p-4">
      {/* Thay thế div.spinner-border bằng Spinner component */}
      <Spinner animation="border" variant="success" role="status" />
    </div>
  );
};

export default LoadingSpinner;