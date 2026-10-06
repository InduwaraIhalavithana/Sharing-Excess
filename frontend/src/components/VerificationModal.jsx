import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config';

export default function VerificationModal({ email, userId, password, role, onClose, onVerified }) {
  const { t } = useLanguage();
  const { login } = useAuth();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDigit = (i, val) => {
    // Allow only single digit
    const cleaned = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = cleaned;
    setDigits(next);
    if (cleaned && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length) {
      const next = ['', '', '', '', '', ''];
      pasted.split('').forEach((ch, i) => { next[i] = ch; });
      setDigits(next);
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  const fullCode = digits.join('');

  const handleVerify = async (e) => {
    e.preventDefault();
    if (fullCode.length < 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, code: fullCode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Email verified! Logging you in…');
        let userData = { email, role };
        try {
          const lr = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const ld = await lr.json();
          if (lr.ok && ld.success) {
            userData = ld.user;
            login(ld.user, ld.token);
          }
        } catch { /* use minimal data */ }
        setTimeout(() => {
          onVerified(userData);
        }, 1200);
      } else {
        setError(data.detail || data.message || 'Invalid verification code.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setVerifying(false);
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) setSuccess('A new code has been sent to your inbox.');
      else setError(data.detail || data.message || 'Could not resend code.');
    } catch {
      setError('Network error.');
    }
    setResending(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('auth', 'verify_title')}</h2>
          <p>{t('auth', 'verify_subtitle')} <strong>{email}</strong></p>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleVerify} noValidate>
            <div className="verify-code-row" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  className={`verify-digit${error ? ' error' : ''}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                  autoComplete="off"
                />
              ))}
            </div>

            {error && <p className="form-error text-center">{error}</p>}
            {success && <p className="form-success text-center">{success}</p>}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={verifying || !!success}
            >
              {verifying ? 'Verifying…' : t('auth', 'verify_btn')}
            </button>
          </form>
        </div>

        <div className="modal-footer">
          <p className="auth-switch">
            {t('auth', 'resend_msg')}{' '}
            <button
              type="button"
              className="auth-link"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? 'Sending…' : t('auth', 'resend')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
