import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
