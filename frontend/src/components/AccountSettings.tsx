import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useMeta } from '../hooks/queries';
import { CATEGORY_ICON, dashboardPath } from '../utils/format';
import { Avatar, DistrictSelect } from './ui';
import { api, ApiError } from '../utils/api';
import {
  deleteAccountSchema, passwordSchema, profileSchema,
  type DeleteAccountForm, type PasswordForm, type ProfileForm,
} from '../lib/schemas';
import type { User } from '../types/api';
import Toast, { type ToastState } from './Toast';


/** A label tied to the first control inside it, so screen readers announce it and a click on the label focuses it. */
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const id = useId();
  let tied = false;
  const kids = Children.map(children, (child) => {
    if (!tied && isValidElement<{ id?: string }>(child) && child.type !== 'p') {
      tied = true;
      return cloneElement(child, { id: child.props.id ?? id });
    }
    return child;
  });
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      {kids}
      {error && <p className="acct-error" role="alert">{error}</p>}
    </div>
  );
}

export default function AccountSettings() {
  const { user, login, logout } = useAuth();
  const { t } = useLanguage();
  const { data: meta } = useMeta();
  const { hash } = useLocation();
  const [toast, setToast] = useState<ToastState | null>(null);

  const profile = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name ?? '',
      phone_number: user?.phone_number ?? '',
      location: user?.location ?? '',
      district: user?.district ?? '',
    },
  });

  const password = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const saveProfile = useMutation({
    mutationFn: (data: ProfileForm) =>
      api<{ user: User }>('/api/auth/me', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: (res) => {
      login(res.user); // keep the navbar name and stored session in sync
      setToast({ msg: t('acct', 'profile_updated') });
    },
    onError: (err: Error) => setToast({ msg: err.message, type: 'error' }),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const savePhoto = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('photo', file);
      return api<{ user: User }>('/api/auth/me/photo', { method: 'POST', body: fd });
    },
    onSuccess: (res) => { login(res.user); setToast({ msg: t('acct', 'photo_updated') }); },
    onError: (err: Error) => setToast({ msg: err.message, type: 'error' }),
  });
  const removePhoto = useMutation({
    mutationFn: () => api<{ user: User }>('/api/auth/me/photo', { method: 'DELETE' }),
    onSuccess: (res) => { login(res.user); setToast({ msg: t('acct', 'photo_removed') }); },
    onError: (err: Error) => setToast({ msg: err.message, type: 'error' }),
  });
  const busyPhoto = savePhoto.isPending || removePhoto.isPending;

  const changePassword = useMutation({
    mutationFn: (data: PasswordForm) =>
      api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: data.current_password, new_password: data.new_password }),
      }),
    onSuccess: () => {
      password.reset();
      setToast({ msg: t('acct', 'password_changed') });
    },
    onError: (err: Error) => {
      // A wrong current password belongs next to that field, not in a toast
      if (err instanceof ApiError && /current password/i.test(err.message)) {
        password.setError('current_password', { message: err.message });
      } else {
        setToast({ msg: err.message, type: 'error' });
      }
    },
  });

  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 150);
  }, [hash, user?.id]);

  // Alert preferences: which districts and food types ring the bell / send an email. Empty = the sensible default.
  const [nDistricts, setNDistricts] = useState<string[]>(user?.notify_districts ?? []);
  const [nTypes, setNTypes] = useState<string[]>(user?.notify_food_types ?? []);
  const [nEmail, setNEmail] = useState<boolean>(user?.notify_email ?? true);
  useEffect(() => {
    setNDistricts(user?.notify_districts ?? []);
    setNTypes(user?.notify_food_types ?? []);
    setNEmail(user?.notify_email ?? true);
  }, [user?.notify_districts, user?.notify_food_types, user?.notify_email]);
  const savePrefs = useMutation({
    mutationFn: () =>
      api<{ user: User }>('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: user?.name, phone_number: user?.phone_number ?? '', location: user?.location ?? '',
          notify_districts: nDistricts, notify_food_types: nTypes, notify_email: nEmail,
        }),
      }),
    onSuccess: (res) => { login(res.user); setToast({ msg: t('acct', 'prefs_saved') }); },
    onError: (err: Error) => setToast({ msg: err.message, type: 'error' }),
  });
  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
    set((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]));

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteForm = useForm<DeleteAccountForm>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  });
  const deleteAccount = useMutation({
    mutationFn: (data: DeleteAccountForm) =>
      api('/api/auth/me', { method: 'DELETE', body: JSON.stringify({ password: data.password }) }),
    onSuccess: () => {
      setToast({ msg: t('acct', 'deleted_bye') });
      setTimeout(logout, 2200); // let the message be read, then sign out (which returns to the home page)
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && /password/i.test(err.message)) {
        deleteForm.setError('password', { message: err.message });
      } else {
        setToast({ msg: err.message, type: 'error' });
      }
    },
  });

  if (!user) return <Navigate to="/" replace />;

  const e1 = profile.formState.errors;
  const e2 = password.formState.errors;

  return (
    <div className="dashboard-page">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}

      <div className="dd-header">
        <div className="acct-hero">
          <button type="button" className="acct-photo" onClick={() => fileRef.current?.click()} disabled={busyPhoto}
            aria-label={t('acct', user.photo ? 'change_photo' : 'add_photo')} title={t('acct', user.photo ? 'change_photo' : 'add_photo')}>
            <Avatar className="acct-avatar" size={84} src={user.photo} name={user.name || user.email} />
            <span className="acct-photo__cam" aria-hidden="true">{busyPhoto ? '…' : '📷'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden aria-label={t('acct', 'change_photo')}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) savePhoto.mutate(f); }} />
          <div>
            <h1 className="dd-title">{t('nav', 'account_settings')}</h1>
            <p className="dd-welcome">
              {user.email} · <span className="acct-role">{t('role', user.role)}</span>
            </p>
            <p className="acct-photo__actions">
              <button type="button" className="acct-photo__btn" onClick={() => fileRef.current?.click()} disabled={busyPhoto}>
                📷 {t('acct', user.photo ? 'change_photo' : 'add_photo')}
              </button>
              {user.photo && (
                <button type="button" className="acct-photo__btn" onClick={() => removePhoto.mutate()} disabled={busyPhoto}>
                  ✕ {t('acct', 'remove_photo')}
                </button>
              )}
              <small>{t('acct', 'photo_hint')}</small>
            </p>
          </div>
        </div>
        <Link to={dashboardPath(user.role)} className="btn btn-primary">← {t('acct', 'back')}</Link>
      </div>

      <div className="acct-grid">
        <form className="dashboard-card acct-card" onSubmit={profile.handleSubmit((d) => saveProfile.mutate(d))} noValidate>
          <h2 className="acct-card__title">👤 {t('acct', 'your_details')}</h2>
          <p className="acct-card__hint">{t('acct', 'details_hint')}</p>

          <Field label={t('acct', 'full_name')} error={e1.name?.message}>
            <input className="form-control" autoComplete="name" {...profile.register('name')} />
          </Field>
          <Field label={t('post', 'phone')} error={e1.phone_number?.message}>
            <input className="form-control" type="tel" autoComplete="tel" placeholder="077 123 4567" {...profile.register('phone_number')} />
          </Field>
          <Field label={t('post', 'district')} error={e1.district?.message}>
            <DistrictSelect value={profile.watch('district')} onChange={(v) => profile.setValue('district', v, { shouldDirty: true, shouldValidate: true })} invalid={!!e1.district} />
            <p className="acct-card__hint">{t('acct', 'district_hint')}</p>
          </Field>
          <Field label={t('acct', 'town')} error={e1.location?.message}>
            <input className="form-control" autoComplete="address-level2" placeholder="e.g. Bandarawela" {...profile.register('location')} />
          </Field>
          <Field label={t('acct', 'email')}>
            <input className="form-control" value={user.email} disabled readOnly />
            <p className="acct-card__hint">{t('acct', 'email_hint')}</p>
          </Field>

          <button className="btn btn-primary" type="submit" disabled={saveProfile.isPending || !profile.formState.isDirty}>
            {saveProfile.isPending ? '…' : t('acct', 'save_changes')}
          </button>
        </form>

        <form className="dashboard-card acct-card" onSubmit={password.handleSubmit((d) => changePassword.mutate(d))} noValidate>
          <h2 className="acct-card__title">🔐 {t('acct', 'change_password')}</h2>
          <p className="acct-card__hint">{t('acct', 'pw_hint')}</p>

          <Field label={t('acct', 'current_pw')} error={e2.current_password?.message}>
            <input className="form-control" type="password" autoComplete="current-password" {...password.register('current_password')} />
          </Field>
          <Field label={t('acct', 'new_pw')} error={e2.new_password?.message}>
            <input className="form-control" type="password" autoComplete="new-password" {...password.register('new_password')} />
          </Field>
          <Field label={t('acct', 'confirm_pw')} error={e2.confirm_password?.message}>
            <input className="form-control" type="password" autoComplete="new-password" {...password.register('confirm_password')} />
          </Field>

          <button className="btn btn-primary" type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending ? '…' : t('acct', 'update_pw')}
          </button>
        </form>
      </div>

      {user.role !== 'admin' && (
        <div className="dashboard-card acct-card" id="notifications">
          <h2 className="acct-card__title">🔔 {t('acct', 'alerts_title')}</h2>
          <p className="acct-card__hint">{t('acct', 'alerts_hint')}</p>
          <span className="form-label">{t('acct', 'alert_districts')}</span>
          <div className="se-catbar">
            {(meta?.districts ?? []).map((d) => (
              <button key={d} type="button" aria-pressed={nDistricts.includes(d)} className={`se-catchip${nDistricts.includes(d) ? ' on' : ''}`}
                onClick={() => toggle(setNDistricts, d)}>{d}</button>
            ))}
          </div>
          <p className="acct-card__hint">{nDistricts.length === 0 ? t('acct', 'districts_default') : `${nDistricts.length} ✓`}</p>
          {user.role !== 'donor' && (
            <>
          <span className="form-label">{t('acct', 'alert_types')}</span>
          <div className="se-catbar">
            {(meta?.categories ?? []).map((c) => (
              <button key={c} type="button" aria-pressed={nTypes.includes(c)} className={`se-catchip${nTypes.includes(c) ? ' on' : ''}`}
                onClick={() => toggle(setNTypes, c)}>{CATEGORY_ICON[c]} {t('cat', c)}</button>
            ))}
          </div>
          <p className="acct-card__hint">{nTypes.length === 0 ? t('acct', 'types_default') : `${nTypes.length} ✓`}</p>
            </>
          )}
          <label className="acct-danger__check" style={{ margin: '12px 0' }}>
            <input type="checkbox" checked={nEmail} onChange={(e) => setNEmail(e.target.checked)} /> {t('acct', 'email_too')}
          </label>
          <button className="btn btn-primary" onClick={() => savePrefs.mutate()} disabled={savePrefs.isPending}>{t('ui', 'save')}</button>
        </div>
      )}

      {user.role !== 'admin' && (
        <div className="dashboard-card acct-danger">
          <h2 className="acct-card__title">🗑️ {t('acct', 'delete_title')}</h2>
          <p className="acct-card__hint">
            {user.role === 'donor' ? t('acct', 'delete_hint_donor') : t('acct', 'delete_hint')}
          </p>
          {!confirmingDelete ? (
            <button className="btn adm-btn-danger" onClick={() => setConfirmingDelete(true)}>{t('acct', 'delete_btn')}</button>
          ) : (
            <form className="acct-danger__form" onSubmit={deleteForm.handleSubmit((d) => deleteAccount.mutate(d))} noValidate>
              <Field label={t('acct', 'your_pw')} error={deleteForm.formState.errors.password?.message}>
                <input className="form-control" type="password" autoComplete="current-password" {...deleteForm.register('password')} />
              </Field>
              <label className="acct-danger__check">
                <input type="checkbox" {...deleteForm.register('understood')} /> {t('acct', 'understand')}
              </label>
              {deleteForm.formState.errors.understood && <p className="acct-error" role="alert">{deleteForm.formState.errors.understood.message}</p>}
              <div className="acct-danger__actions">
                <button className="btn adm-btn-danger" type="submit" disabled={deleteAccount.isPending}>
                  {deleteAccount.isPending ? '…' : t('acct', 'delete_perm')}
                </button>
                <button className="btn btn-outline" type="button" onClick={() => { setConfirmingDelete(false); deleteForm.reset(); }}>{t('acct', 'keep')}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
