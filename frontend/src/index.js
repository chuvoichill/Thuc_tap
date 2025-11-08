import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotifyProvider } from './context/NotifyContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';

// Import CSS
import './assets/index.css';
import './assets/App.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotifyProvider>
          <App />
        </NotifyProvider>
      </AuthProvider>
    </BrowserRouter>
  // </React.StrictMode>
);