import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="text-center p-4">
      <div className="spinner-border text-success" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
};

export default LoadingSpinner;