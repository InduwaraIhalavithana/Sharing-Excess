import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { API_BASE, APP_ROOT } from './config';
import Toast from './components/Toast';

export default function FeedbackPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({ comment: '', image: null, imagePreview: null });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/feedback`);
      const data = await res.json();
      if (data.success) setList(data.feedback || []);
    } catch {
      showToast('Failed to load feedback.', 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setFormError('Please select a valid image (JPEG, PNG, GIF, WebP).'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image must be under 5 MB.'); return;
    }
    setForm(p => ({ ...p, image: file, imagePreview: URL.createObjectURL(file) }));
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.comment.trim()) { setFormError('Please enter a comment.'); return; }
    if (!user) { showToast('Please sign in to leave feedback.', 'error'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const fd = new FormData();
      fd.append('recipient_id', user.id);
      fd.append('comment', form.comment);
      if (form.image) fd.append('image', form.image);
      const res = await fetch(`${API_BASE}/api/feedback`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        showToast('Feedback submitted!');
        setForm({ comment: '', image: null, imagePreview: null });
        setShowForm(false);
        fetchFeedback();
      } else {
        setFormError(data.message || 'Submission failed.');
      }
    } catch {
      setFormError('Network error. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <div className="feedback-page">
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Hero */}
      <div className="feedback-hero">
        <div className="container">
          <h1 className="feedback-hero__title">💬 {t('feedback', 'title')}</h1>
          <p className="feedback-hero__sub">{t('feedback', 'subtitle')}</p>
        </div>
      </div>

      <div className="container feedback-body">
        <div className="feedback-layout">

          {/* Main feed column */}
          <div className="feedback-main">

            {/* Submit button */}
            {user && (
              <div className="feedback-action-row">
                <button
                  className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => setShowForm(p => !p)}
                >
                  {showForm ? '✕ Cancel' : '✨ Share Your Feedback'}
                </button>
              </div>
            )}

            {!user && (
              <div className="feedback-login-prompt">
                <p>
                  <button
                    className="auth-link-btn"
                    onClick={() => window.dispatchEvent(new Event('openLogin'))}
                  >
                    Sign in
                  </button>
                  {' '}to share your experience with the community.
                </p>
              </div>
            )}

            {/* Submit form */}
            {showForm && (
              <div className="feedback-form-card card">
                <h3 className="feedback-form-card__title">Share Your Feedback</h3>
                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-group">
                    <label className="form-label">Your Experience *</label>
                    <textarea
                      className="form-control"
                      value={form.comment}
                      onChange={e => { setForm(p => ({ ...p, comment: e.target.value })); setFormError(''); }}
                      placeholder="Share your experience…"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Attach Photo (optional)</label>
                    <input
                      className="form-control"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    {form.imagePreview && (
                      <div className="feedback-img-preview-wrap">
                        <img src={form.imagePreview} alt="Preview" className="feedback-img-preview" />
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ marginTop: 6 }}
                          onClick={() => setForm(p => ({ ...p, image: null, imagePreview: null }))}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {formError && <p className="form-error" style={{ marginBottom: 12 }}>{formError}</p>}

                  <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting…' : 'Submit Feedback'}
                  </button>
                </form>
              </div>
            )}

            {/* Feed */}
            <div className="feedback-feed">
              <h2 className="feedback-feed__title">{t('feedback', 'all_feedback')}</h2>

              {loading ? (
                <div className="dd-loading"><span className="dd-spinner" /> Loading…</div>
              ) : list.length === 0 ? (
                <div className="dd-empty">
                  <span className="dd-empty__icon">💬</span>
                  <p>No feedback yet. Be the first to share your experience!</p>
                </div>
              ) : (
                <div className="feedback-grid">
                  {list.map(fb => (
                    <div key={fb.id} className="feedback-card card">
                      <div className="feedback-card__header">
                        <div className="feedback-card__avatar">
                          {(fb.recipient_name || 'A').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="feedback-card__name">{fb.recipient_name || 'Anonymous'}</p>
                          <p className="feedback-card__date">
                            {new Date(fb.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {fb.comment && (
                        <p className="feedback-card__comment">"{fb.comment}"</p>
                      )}

                      {fb.image_path && (
                        <img
                          className="feedback-card__img"
                          src={`${APP_ROOT}${fb.image_path}`}
                          alt="Feedback"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="feedback-sidebar">

            <div className="feedback-stats card">
              <h3 className="feedback-stats__title">Community Impact</h3>
              <div className="feedback-stats__grid">
                <div className="feedback-stat-item">
                  <span className="feedback-stat-item__value">{list.length || '1'}+</span>
                  <span className="feedback-stat-item__label">Reviews</span>
                </div>
                <div className="feedback-stat-item">
                  <span className="feedback-stat-item__value">1,575+</span>
                  <span className="feedback-stat-item__label">Meals Shared</span>
                </div>
                <div className="feedback-stat-item">
                  <span className="feedback-stat-item__value">50+</span>
                  <span className="feedback-stat-item__label">Donors</span>
                </div>
                <div className="feedback-stat-item">
                  <span className="feedback-stat-item__value">12</span>
                  <span className="feedback-stat-item__label">NGO Partners</span>
                </div>
              </div>
            </div>

            <div className="feedback-why card">
              <h3 className="feedback-why__title">Why It Matters</h3>
              <ul className="feedback-why__list">
                <li>💬 Feedback helps us improve our platform</li>
                <li>🤝 Your story inspires other donors</li>
                <li>📊 We use reviews to track community health</li>
                <li>🌱 Every voice helps us grow our mission</li>
              </ul>
            </div>

            <div className="feedback-quote card">
              <div className="feedback-quote__icon">🌟</div>
              <p className="feedback-quote__text">"Every meal saved is a family helped. Share your story and inspire others to join the movement."</p>
              <p className="feedback-quote__author">— Sharing Excess Team</p>
            </div>

          </aside>
        </div>
      </div>
    </div>
  );
}
