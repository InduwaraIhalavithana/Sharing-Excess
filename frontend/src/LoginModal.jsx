import { useState, useEffect } from 'react';
import { useLanguage } from './i18n/LanguageContext.jsx';
import { useAuth } from './contexts/AuthContext.jsx';
import { API_BASE } from './config.js';

export default function LoginModal({ onClose, onLoginSuccess, onSwitchToSignup, onForgotPassword }) {
  const { t } = useLanguage();
  const { login } = useAuth();
  const [mode, setMode] = useState('user'); // 'user' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const isAdmin = email.trim() === 'admin@sharingexcess.com';
      const role = mode === 'admin' ? 'admin' : (isAdmin ? 'admin' : '');
      const endpoint = mode === 'admin'
        ? `${API_BASE}/api/auth/officer-login`
        : `${API_BASE}/api/auth/login`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const rawUser = data.user || data.officer;
        const user = {
          id: rawUser.id,
          name: rawUser.name || 'User',
          email: rawUser.email,
          role: rawUser.role || role
        };
        login(user, data.token);
        onLoginSuccess(user);
      } else {
        setError(data.detail || data.message || 'Invalid email or password.');
      }
    } catch {
      setError('Could not connect to server.');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'admin' ? t('auth', 'admin_login') : t('auth', 'login_title')}</h2>
          <p>{t('auth', 'login_subtitle')}</p>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <div className="auth-mode-tabs">
            <button
              type="button"
              className={`auth-tab${mode === 'user' ? ' active' : ''}`}
              onClick={() => setMode('user')}
            >
              👤 User
            </button>
            <button
              type="button"
              className={`auth-tab${mode === 'admin' ? ' active' : ''}`}
              onClick={() => setMode('admin')}
            >
              🏅 {t('auth', 'admin_login')}
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label">{t('auth', 'email')}</label>
              <input
                className="form-control"
                type="email"
                placeholder={t('auth', 'email_placeholder')}
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('auth', 'password')}</label>
              <div className="input-with-eye">
                <input
                  className="form-control"
                  type={showPw ? 'text' : 'password'}
                  placeholder={t('auth', 'password_placeholder')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPw(p => !p)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {mode === 'user' && (
              <div className="auth-forgot-row">
                <button type="button" className="auth-link-btn" onClick={onForgotPassword}>
                  {t('auth', 'forgot_password')}
                </button>
              </div>
            )}

            {error && <p className="form-error">{error}</p>}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? 'Signing in…' : t('auth', 'login_btn')}
            </button>
          </form>
        </div>

        <div className="modal-footer">
          <p className="auth-switch">
            {t('auth', 'no_account')}{' '}
            <button type="button" className="auth-link" onClick={onSwitchToSignup}>
              {t('auth', 'signup_link')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
