import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from './contexts/AuthContext';
import { useLanguage } from './i18n/LanguageContext';
import { usePublicStats } from './hooks/queries';
import { api } from './utils/api';
import Toast, { type ToastState } from './components/Toast';
import { RatingInput } from './components/ui';

const MAX_MB = 5;

/** A private message to the admin about the platform. (Ratings of donors and recipients live on their profiles.) */
export default function FeedbackPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: stats } = usePublicStats();
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  const send = useMutation({
    mutationFn: (fd: FormData) => api<{ success: boolean }>('/api/feedback', { method: 'POST', body: fd }),
    onSuccess: () => { setToast({ msg: t('feedback', 'sent') }); setComment(''); setRating(0); setImage(null); },
    onError: (err: Error) => setError(err.message),
  });

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError(t('post', 'not_image')); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(t('post', 'too_big')); return; }
    setImage(file);
    setError('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) { setError(t('feedback', 'e_comment')); return; }
    setError('');
    const fd = new FormData();
    fd.append('comment', comment.trim());
    if (rating) fd.append('rating', String(rating));
    if (image) fd.append('image', image);
    send.mutate(fd);
  };

  return (
    <div className="feedback-page">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}
      <div className="feedback-hero">
        <div className="container">
          <h1 className="feedback-hero__title">💬 {t('feedback', 'title')}</h1>
          <p className="feedback-hero__sub">{t('feedback', 'subtitle')}</p>
        </div>
      </div>

      <div className="container feedback-body">
        <div className="feedback-layout">
          <div className="feedback-main">
            {!user ? (
              <div className="feedback-login-prompt feedback-login-prompt--cta">
                <span className="feedback-login-prompt__icon" aria-hidden="true">💬</span>
                <p>{t('feedback', 'login_to_send')}</p>
                <div className="feedback-login-prompt__btns">
                  <button className="btn btn-primary" onClick={() => window.dispatchEvent(new Event('openLogin'))}>{t('nav', 'login')}</button>
                  <button className="btn btn-outline" onClick={() => window.dispatchEvent(new Event('openSignup'))}>{t('nav', 'signup')}</button>
                </div>
              </div>
            ) : user.role === 'admin' ? (
              <div className="feedback-login-prompt"><p>{t('feedback', 'admin_reads')}</p></div>
            ) : (
              <div className="feedback-form-card card">
                <h3 className="feedback-form-card__title">{t('feedback', 'form_title')}</h3>
                <p className="pf-hint">🔒 {t('feedback', 'private_note')}</p>
                <form onSubmit={submit} noValidate>
                  <div className="form-group">
                    <span className="form-label">{t('feedback', 'how_rate')}</span>
                    <RatingInput value={rating} onChange={setRating} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="fb-comment">{t('feedback', 'your_message')} *</label>
                    <textarea id="fb-comment" className="form-control" rows={5} maxLength={3000} value={comment} onChange={(e) => setComment(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="fb-photo">{t('feedback', 'photo_optional')}</label>
                    <input id="fb-photo" className="form-control" type="file" accept="image/*" onChange={onImage} />
                    {image && <p className="pf-hint">📎 {image.name} <button type="button" className="auth-link-btn" onClick={() => setImage(null)}>✕</button></p>}
                  </div>
                  {error && <p className="form-error" role="alert" style={{ marginBottom: 12 }}>{error}</p>}
                  <button className="btn btn-primary btn-block" type="submit" disabled={send.isPending}>{t('feedback', 'send')}</button>
                </form>
              </div>
            )}
          </div>

          <aside className="feedback-sidebar">
            <div className="feedback-stats card">
              <h3 className="feedback-stats__title">{t('feedback', 'impact')}</h3>
              <div className="feedback-stats__grid">
                {[
                  [stats?.handovers_completed, t('impact', 'handovers')],
                  [stats?.donors, t('impact', 'donors')],
                  [stats?.recipients, t('impact', 'recipients')],
                  [stats?.ngos, t('impact', 'ngos')],
                ].map(([v, label]) => (
                  <div key={String(label)} className="feedback-stat-item">
                    <span className="feedback-stat-item__value">{Number(v ?? 0).toLocaleString()}</span>
                    <span className="feedback-stat-item__label">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
