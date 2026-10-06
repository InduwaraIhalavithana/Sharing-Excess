import { useState, useEffect } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useLanguage } from '../i18n/LanguageContext';
import { API_BASE } from '../config';

export default function ForgotPasswordModal({ onClose, onBackToLogin }) {
  const boxRef = useModalA11y();
  const { t } = useLanguage();
  const [step, setStep] = useState(1); // 1: email, 2: code + new pw, 3: success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage('A reset code has been sent to your email.');
        setStep(2);
      } else {
        setError(data.detail || data.message || 'Failed to send reset code.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, new_password: newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep(3);
      } else {
        setError(data.detail || data.message || 'Password reset failed.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const stepLabels = ['Send Code', 'Reset Password', 'Done'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={boxRef} className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('auth', 'forgot_title')}</h2>
          <p>
            {step === 1 && t('auth', 'forgot_subtitle')}
            {step === 2 && 'Enter the code sent to your email.'}
            {step === 3 && 'Password reset successfully!'}
          </p>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {/* Step indicator */}
          <div className="forgot-steps">
            {stepLabels.map((label, i) => (
              <div key={i} className={`forgot-step${step > i ? ' done' : step === i + 1 ? ' active' : ''}`}>
                <span className="forgot-step__dot">{step > i ? '✓' : i + 1}</span>
                <span className="forgot-step__label">{label}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <form onSubmit={handleSendCode} noValidate>
              <div className="form-group">
                <label className="form-label">{t('auth', 'email')}</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder={t('auth', 'email_placeholder')}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                {loading ? 'Sending…' : t('auth', 'forgot_btn')}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleReset} noValidate>
              {message && <p className="form-success">{message}</p>}
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="Enter the 6-digit code"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div className="input-with-eye">
                  <input
                    className="form-control"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
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
              {error && <p className="form-error">{error}</p>}
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="verify-success">
              <div className="verify-success__icon">✅</div>
              <p className="verify-success__title">Password Updated!</p>
              <p className="verify-success__text">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={onBackToLogin}
              >
                {t('auth', 'back_login')}
              </button>
            </div>
          )}
        </div>

        {step < 3 && (
          <div className="modal-footer">
            <p className="auth-switch">
              <button type="button" className="auth-link" onClick={onBackToLogin}>
                ← {t('auth', 'back_login')}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
