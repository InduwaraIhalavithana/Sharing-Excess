import { useState, useEffect } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useLanguage } from '../i18n/LanguageContext';
import { API_BASE } from '../config';
import { DistrictSelect } from './ui';

export default function SignupModal({ onClose, onSignupSuccess, onSwitchToLogin }) {
  const boxRef = useModalA11y();
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    role: '', phone_number: '', location: '', district: '', org_name: '', org_description: ''
  });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setField = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email format';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Minimum 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!form.role) e.role = 'Please select a role';
    if (!form.phone_number.trim()) e.phone_number = 'Phone is required';
    if (!form.district) e.district = t('post', 'e_district');
    if (form.role === 'ngo' && form.org_name.trim().length < 2) e.org_name = t('auth', 'org_name_required');
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setErrors({});
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, email: form.email, password: form.password,
          role: form.role, phone_number: form.phone_number, location: form.location,
          district: form.district, org_name: form.org_name, org_description: form.org_description
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSignupSuccess({
          email: form.email,
          user_id: data.user_id,
          password: form.password,
          role: form.role
        });
      } else {
        setErrors({ submit: data.detail || data.message || 'Signup failed. Please try again.' });
      }
    } catch {
      setErrors({ submit: 'Could not connect to server.' });
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={boxRef} className="modal-box modal-box--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('auth', 'signup_title')}</h2>
          <p>{t('auth', 'signup_subtitle')}</p>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">{t('auth', 'name')}</label>
                <input
                  className={`form-control${errors.name ? ' error' : ''}`}
                  type="text"
                  placeholder={t('auth', 'name_placeholder')}
                  value={form.name}
                  onChange={setField('name')}
                  autoFocus
                />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('auth', 'email')}</label>
                <input
                  className={`form-control${errors.email ? ' error' : ''}`}
                  type="email"
                  placeholder={t('auth', 'email_placeholder')}
                  value={form.email}
                  onChange={setField('email')}
                />
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">{t('auth', 'password')}</label>
                <div className="input-with-eye">
                  <input
                    className={`form-control${errors.password ? ' error' : ''}`}
                    type={showPw ? 'text' : 'password'}
                    placeholder={t('auth', 'password_hint')}
                    value={form.password}
                    onChange={setField('password')}
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
                {errors.password && <span className="form-error">{errors.password}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('auth', 'confirm_password')}</label>
                <input
                  className={`form-control${errors.confirmPassword ? ' error' : ''}`}
                  type="password"
                  placeholder={t('auth', 'confirm_placeholder')}
                  value={form.confirmPassword}
                  onChange={setField('confirmPassword')}
                />
                {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('auth', 'role')}</label>
              <div className="role-cards">
                {[
                  { value: 'donor', icon: '🍽️', label: t('auth', 'role_donor') },
                  { value: 'recipient', icon: '🤝', label: t('auth', 'role_recipient') },
                  { value: 'ngo', icon: '🏢', label: t('auth', 'role_ngo') }
                ].map(r => (
                  <label
                    key={r.value}
                    className={`role-card${form.role === r.value ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={form.role === r.value}
                      onChange={setField('role')}
                    />
                    <span className="role-card__icon">{r.icon}</span>
                    <span className="role-card__label">{r.label}</span>
                  </label>
                ))}
              </div>
              {errors.role && <span className="form-error">{errors.role}</span>}
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">{t('post', 'phone')}</label>
                <input
                  className={`form-control${errors.phone_number ? ' error' : ''}`}
                  type="tel"
                  placeholder="+94 7X XXX XXXX"
                  value={form.phone_number}
                  onChange={setField('phone_number')}
                />
                {errors.phone_number && <span className="form-error">{errors.phone_number}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('post', 'district')}</label>
                <DistrictSelect value={form.district} invalid={!!errors.district}
                  onChange={(v) => { setForm(p => ({ ...p, district: v })); if (errors.district) setErrors(p => ({ ...p, district: '' })); }} />
                {errors.district && <span className="form-error">{errors.district}</span>}
              </div>
            </div>

            {form.role === 'ngo' && (
              <>
                <div className="form-group">
                  <label className="form-label">{t('ngo', 'org_name')}</label>
                  <input className={`form-control${errors.org_name ? ' error' : ''}`} value={form.org_name} onChange={setField('org_name')} maxLength={200} />
                  {errors.org_name && <span className="form-error">{errors.org_name}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">{t('ngo', 'org_desc')}</label>
                  <textarea className="form-control" rows={2} value={form.org_description} onChange={setField('org_description')} maxLength={2000} />
                  <small className="pf-hint">ℹ️ {t('auth', 'ngo_approval_note')}</small>
                </div>
              </>
            )}

            {errors.submit && <p className="form-error">{errors.submit}</p>}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? 'Creating account…' : t('auth', 'signup_btn')}
            </button>
          </form>
        </div>

        <div className="modal-footer">
          <p className="auth-switch">
            {t('auth', 'already_account')}{' '}
            <button type="button" className="auth-link" onClick={onSwitchToLogin}>
              {t('auth', 'login_link')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
