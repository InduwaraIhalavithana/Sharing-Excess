import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../utils/api';
import {
  deleteAccountSchema, passwordSchema, profileSchema,
  type DeleteAccountForm, type PasswordForm, type ProfileForm,
} from '../lib/schemas';
import type { User } from '../types/api';
import Toast, { type ToastState } from './Toast';

const ROLE_LABEL: Record<string, string> = {
  donor: 'Donor',
  recipient: 'Recipient',
  adminofficer: 'Admin Officer',
};

const HOME_FOR: Record<string, string> = {
  donor: '/donor-dashboard',
  recipient: '/recipient-dashboard',
  adminofficer: '/admin',
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {error && <p className="acct-error" role="alert">{error}</p>}
    </div>
  );
}

export default function AccountSettings() {
  const { user, login, logout } = useAuth();
  const [toast, setToast] = useState<ToastState | null>(null);

  const profile = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name ?? '',
      phone_number: user?.phone_number ?? '',
      location: user?.location ?? '',
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
      setToast({ msg: 'Profile updated.' });
    },
    onError: (err: Error) => setToast({ msg: err.message, type: 'error' }),
  });

  const changePassword = useMutation({
    mutationFn: (data: PasswordForm) =>
      api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: data.current_password, new_password: data.new_password }),
      }),
    onSuccess: () => {
      password.reset();
      setToast({ msg: 'Password changed.' });
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

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteForm = useForm<DeleteAccountForm>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  });
  const deleteAccount = useMutation({
    mutationFn: (data: DeleteAccountForm) =>
      api('/api/auth/me', { method: 'DELETE', body: JSON.stringify({ password: data.password }) }),
    onSuccess: () => {
      setToast({ msg: 'Your account and its data have been deleted. Goodbye - thank you for sharing.' });
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

  const initial = (user.name || user.email).charAt(0).toUpperCase();
  const e1 = profile.formState.errors;
  const e2 = password.formState.errors;

  return (
    <div className="dashboard-page">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}

      <div className="dd-header">
        <div className="acct-hero">
          <div className="acct-avatar" aria-hidden="true">{initial}</div>
          <div>
            <h1 className="dd-title">Account settings</h1>
            <p className="dd-welcome">
              {user.email} · <span className="acct-role">{ROLE_LABEL[user.role] ?? user.role}</span>
            </p>
          </div>
        </div>
        <Link to={HOME_FOR[user.role] ?? '/'} className="btn btn-primary">← Back to dashboard</Link>
      </div>

      <div className="acct-grid">
        <form className="dashboard-card acct-card" onSubmit={profile.handleSubmit((d) => saveProfile.mutate(d))} noValidate>
          <h2 className="acct-card__title">👤 Your details</h2>
          <p className="acct-card__hint">Donors and recipients see your name and phone to coordinate pickups.</p>

          <Field label="Full name" error={e1.name?.message}>
            <input className="form-control" autoComplete="name" {...profile.register('name')} />
          </Field>
          <Field label="Phone number" error={e1.phone_number?.message}>
            <input className="form-control" type="tel" autoComplete="tel" placeholder="077 123 4567" {...profile.register('phone_number')} />
          </Field>
          <Field label="Location" error={e1.location?.message}>
            <input className="form-control" autoComplete="address-level2" placeholder="e.g. Badulla" {...profile.register('location')} />
          </Field>
          <Field label="Email">
            <input className="form-control" value={user.email} disabled readOnly />
            <p className="acct-card__hint">Your email is your login and can't be changed here.</p>
          </Field>

          <button className="btn btn-primary" type="submit" disabled={saveProfile.isPending || !profile.formState.isDirty}>
            {saveProfile.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <form className="dashboard-card acct-card" onSubmit={password.handleSubmit((d) => changePassword.mutate(d))} noValidate>
          <h2 className="acct-card__title">🔐 Change password</h2>
          <p className="acct-card__hint">Use at least 8 characters. You'll stay signed in on this device.</p>

          <Field label="Current password" error={e2.current_password?.message}>
            <input className="form-control" type="password" autoComplete="current-password" {...password.register('current_password')} />
          </Field>
          <Field label="New password" error={e2.new_password?.message}>
            <input className="form-control" type="password" autoComplete="new-password" {...password.register('new_password')} />
          </Field>
          <Field label="Confirm new password" error={e2.confirm_password?.message}>
            <input className="form-control" type="password" autoComplete="new-password" {...password.register('confirm_password')} />
          </Field>

          <button className="btn btn-primary" type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      {user.role !== 'adminofficer' && (
        <div className="dashboard-card acct-danger">
          <h2 className="acct-card__title">🗑️ Delete my account</h2>
          <p className="acct-card__hint">
            This permanently removes your account and everything tied to it: your {user.role === 'donor' ? 'listings' : 'requests'},
            feedback, event sign-ups and uploaded photos. It cannot be undone. Donation records may be kept for accounting.
          </p>
          {!confirmingDelete ? (
            <button className="btn adm-btn-danger" onClick={() => setConfirmingDelete(true)}>Delete my account…</button>
          ) : (
            <form className="acct-danger__form" onSubmit={deleteForm.handleSubmit((d) => deleteAccount.mutate(d))} noValidate>
              <Field label="Your password" error={deleteForm.formState.errors.password?.message}>
                <input className="form-control" type="password" autoComplete="current-password" {...deleteForm.register('password')} />
              </Field>
              <label className="acct-danger__check">
                <input type="checkbox" {...deleteForm.register('understood')} /> I understand this cannot be undone
              </label>
              {deleteForm.formState.errors.understood && <p className="acct-error" role="alert">{deleteForm.formState.errors.understood.message}</p>}
              <div className="acct-danger__actions">
                <button className="btn adm-btn-danger" type="submit" disabled={deleteAccount.isPending}>
                  {deleteAccount.isPending ? 'Deleting…' : 'Permanently delete my account'}
                </button>
                <button className="btn btn-outline" type="button" onClick={() => { setConfirmingDelete(false); deleteForm.reset(); }}>Keep my account</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
