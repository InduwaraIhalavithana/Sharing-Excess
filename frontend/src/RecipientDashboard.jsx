import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { parseApiErrors } from './utils/formErrors';
import { APP_ROOT } from './config';
import { useDebounced } from './hooks/useDebounced';
import {
  usePublicListings, useMyRequests, useCreateWithForm, useDeleteRequest,
} from './hooks/queries';
import FeedbackForm from './components/FeedbackForm';
import { SkeletonGrid } from './components/SkeletonCard.jsx';
import Toast from './components/Toast';
import { TourKit, useTour, GettingStartedChecklist } from './components/tour/TourKit';

function StatusBadge({ status }) {
  const map = {
    pending:   'badge badge-amber',
    accepted:  'badge badge-blue',
    delivered: 'badge badge-green',
    declined:  'badge badge-red',
    available: 'badge badge-green',
  };
  return (
    <span className={map[status?.toLowerCase()] || 'badge badge-gray'}>
      {status}
    </span>
  );
}

function StatusTimeline({ status }) {
  const steps = ['pending', 'accepted', 'delivered'];
  const idx = steps.indexOf(status?.toLowerCase());
  return (
    <div className="req-timeline">
      {steps.map((step, i) => (
        <div key={step} className={`req-timeline__step${i <= idx ? ' done' : ''}${i === idx ? ' current' : ''}`}>
          <div className="req-timeline__dot" />
          <span className="req-timeline__label">{step}</span>
          {i < steps.length - 1 && <div className="req-timeline__line" />}
        </div>
      ))}
    </div>
  );
}

export default function RecipientDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [tab, setTab] = useState('available');
  const [toast, setToast] = useState(null);

  // Custom request form
  const [showForm, setShowForm] = useState(false);
  const [customReq, setCustomReq] = useState({
    food_name: '', quantity: '', needed_by: '', location: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Feedback
  const [feedbackFor, setFeedbackFor] = useState(null);

  // Search (debounced so we don't hit the API on every keystroke)
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);

  const tour = useTour('recipient');
  const listingsQ = usePublicListings({ q: debouncedSearch, limit: 50 });
  const requestsQ = useMyRequests(user?.id);
  const createRequest = useCreateWithForm('/api/requests');
  const removeRequest = useDeleteRequest();

  const foodListings = listingsQ.data?.listings ?? [];
  const myRequests = requestsQ.data?.requests ?? [];
  const loading = listingsQ.isPending || requestsQ.isPending;
  const formLoading = createRequest.isPending;

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
  }, []);

  useEffect(() => {
    if (listingsQ.isError || requestsQ.isError) showToast('Failed to load data.', 'error');
  }, [listingsQ.isError, requestsQ.isError, showToast]);

  const fetchAll = () => { listingsQ.refetch(); requestsQ.refetch(); };

  const handleRequestListing = async (listing) => {
    if (!user || user.role !== 'recipient') {
      showToast('Please log in as a recipient.', 'error');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('food_name', listing.food_name);
      fd.append('quantity', listing.quantity);
      fd.append('needed_by', new Date().toISOString().split('T')[0]);
      fd.append('location', user.location || '');
      fd.append('listing_id', listing.id);
      await createRequest.mutateAsync(fd);
      showToast('Food request submitted!');
    } catch (err) {
      showToast(err.message || 'Request failed.', 'error');
    }
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    if (!user || user.role !== 'recipient') {
      showToast('Please log in as a recipient.', 'error');
      return;
    }
    setFormErrors({});
    try {
      const fd = new FormData();
      fd.append('food_name', customReq.food_name);
      fd.append('quantity', customReq.quantity);
      fd.append('needed_by', customReq.needed_by);
      fd.append('location', customReq.location);
      await createRequest.mutateAsync(fd);
      showToast('Custom request submitted!');
      setShowForm(false);
      setCustomReq({ food_name: '', quantity: '', needed_by: '', location: '' });
    } catch (err) {
      const errs = parseApiErrors(err.body);
      if (Object.keys(errs).length && !errs._) setFormErrors(errs);
      else showToast(err.message || 'Submission failed.', 'error');
    }
  };

  const handleDeleteRequest = async (requestId) => {
    try {
      await removeRequest.mutateAsync(requestId);
      showToast('Request deleted.');
    } catch (err) {
      showToast(err.message || 'Delete failed.', 'error');
    }
  };

  // Stats
  const available = foodListings.length;
  const myPending  = myRequests.filter(r => r.status === 'pending').length;
  const delivered  = myRequests.filter(r => r.status === 'delivered').length;
  const stats = [
    { icon: '🍽️', value: available,        label: t('recipient', 'available_food') },
    { icon: '📬', value: myRequests.length, label: t('recipient', 'my_requests') },
    { icon: '⏳', value: myPending,         label: t('recipient', 'status_pending') },
    { icon: '✅', value: delivered,         label: t('recipient', 'status_delivered') },
  ];

  const TABS = [
    { key: 'available', label: `🍽️ ${t('recipient', 'available_food')} (${available})` },
    { key: 'requests',  label: `📬 ${t('recipient', 'my_requests')} (${myRequests.length})` },
  ];

  return (
    <div className="dashboard-page">
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Header */}
      <div className="dd-header">
        <div>
          <h1 className="dd-title">{t('recipient', 'dashboard_title')}</h1>
          <p className="dd-welcome">{t('recipient', 'welcome')} <strong>{user?.name}</strong></p>
        </div>
        <button className="btn btn-primary" data-tour="recipient-request" onClick={() => { setShowForm(p => !p); setTab('requests'); }}>
          + {t('recipient', 'request_food')}
        </button>
      </div>

      <GettingStartedChecklist
        storageKey="se-checklist-recipient"
        items={[
          { id: 'profile', label: t('tour', 'check_profile'), href: '/account', done: !!(user?.phone_number && user?.location) },
          { id: 'request', label: t('tour', 'check_first_request'), href: '/recipient-dashboard', done: myRequests.length > 0 },
          { id: 'received', label: t('tour', 'check_first_received'), href: '/recipient-dashboard', done: myRequests.some(r => r.status === 'delivered') },
        ]}
      />

      {/* Stats */}
      <div className="stats-grid" data-tour="recipient-stats">
        {stats.map(s => (
          <div key={s.label} className="dashboard-card stat-card">
            <span className="stat-card__icon">{s.icon}</span>
            <span className="stat-card__value">{loading ? '—' : s.value}</span>
            <span className="stat-card__label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Custom request form */}
      {showForm && (
        <div className="dd-inline-form">
          <h3 className="dd-form-title">📝 Submit Custom Food Request</h3>
          <form onSubmit={handleCustomSubmit} noValidate>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Food Item</label>
                <input className={`form-control${formErrors.food_name ? ' error' : ''}`} type="text" placeholder="What food do you need?"
                  value={customReq.food_name} onChange={e => { setCustomReq(p => ({ ...p, food_name: e.target.value })); setFormErrors(p => ({ ...p, food_name: '' })); }} required />
                {formErrors.food_name && <span className="form-error">{formErrors.food_name}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className={`form-control${formErrors.quantity ? ' error' : ''}`} type="text" placeholder="e.g. 5 kg"
                  value={customReq.quantity} onChange={e => { setCustomReq(p => ({ ...p, quantity: e.target.value })); setFormErrors(p => ({ ...p, quantity: '' })); }} required />
                {formErrors.quantity && <span className="form-error">{formErrors.quantity}</span>}
              </div>
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Needed By</label>
                <input className={`form-control${formErrors.needed_by ? ' error' : ''}`} type="date"
                  value={customReq.needed_by} onChange={e => { setCustomReq(p => ({ ...p, needed_by: e.target.value })); setFormErrors(p => ({ ...p, needed_by: '' })); }} required />
                {formErrors.needed_by && <span className="form-error">{formErrors.needed_by}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Location</label>
                <input className={`form-control${formErrors.location ? ' error' : ''}`} type="text" placeholder="City / District"
                  value={customReq.location} onChange={e => { setCustomReq(p => ({ ...p, location: e.target.value })); setFormErrors(p => ({ ...p, location: '' })); }} required />
                {formErrors.location && <span className="form-error">{formErrors.location}</span>}
              </div>
            </div>
            <div className="dd-form-actions">
              <button type="submit" className="btn btn-primary" disabled={formLoading}>
                {formLoading ? 'Submitting…' : 'Submit Request'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="dd-tabs" data-tour="recipient-tabs">
        {TABS.map(tb => (
          <button
            key={tb.key}
            className={`dd-tab${tab === tb.key ? ' active' : ''}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
        <button className="dd-refresh" onClick={fetchAll} title="Refresh">↻</button>
      </div>

      {loading ? (
        <SkeletonGrid count={6} />
      ) : (
        <>
          {/* Available Listings */}
          {tab === 'available' && (
            <>
              <div className="dd-search-row" data-tour="recipient-search">
                <input
                  className="form-control"
                  type="text"
                  placeholder="Search food name, location…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ maxWidth: 320 }}
                />
                {search && (
                  <button className="btn btn-outline btn-sm" onClick={() => setSearch('')}>
                    ✕ Clear
                  </button>
                )}
              </div>
            <div className="cards-grid" data-tour="recipient-food">
              {foodListings.length === 0 ? (
                <div className="dd-empty">
                  <span className="dd-empty__icon">🍽️</span>
                  <p>{t('recipient', 'no_food')}</p>
                </div>
              ) : foodListings.map(l => (
                <div key={l.id} className="dashboard-card">
                  {l.image_path && (
                    <img
                      className="dd-listing-img"
                      src={`${APP_ROOT}${l.image_path}`}
                      alt={l.food_name}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="dd-card-info" style={{ padding: '0 4px' }}>
                    <div className="dd-card-title">{l.food_name}</div>
                    <p className="dd-card-meta">📦 {l.quantity}</p>
                    <p className="dd-card-meta">📅 Expires: {l.expiry_date}</p>
                    <p className="dd-card-meta">📍 {l.location}</p>
                    {l.description && <p className="dd-card-meta">{l.description}</p>}
                  </div>
                  <div className="dd-card-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleRequestListing(l)}
                    >
                      📦 {t('recipient', 'request_food')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}

          {/* My Requests */}
          {tab === 'requests' && (
            <div className="cards-grid">
              {myRequests.length === 0 ? (
                <div className="dd-empty">
                  <span className="dd-empty__icon">📭</span>
                  <p>{t('recipient', 'no_requests')}</p>
                </div>
              ) : myRequests.map(req => (
                <div key={req.id} className={`dashboard-card dd-status-${req.status}`}>
                  <div className="dd-card-top">
                    <div className="dd-card-info">
                      <div className="dd-card-title">{req.food_name || req.food_item}</div>
                      <p className="dd-card-meta">📦 {req.quantity}</p>
                      {req.needed_by && <p className="dd-card-meta">📅 Needed by: {req.needed_by}</p>}
                      <p className="dd-card-meta">📍 {req.location}</p>
                      {req.donor_name && <p className="dd-card-meta">🤝 Donor: {req.donor_name}</p>}
                      {req.donor_phone && req.status === 'accepted' && (
                        <p className="dd-card-meta">📞 {req.donor_phone}</p>
                      )}
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  <StatusTimeline status={req.status} />
                  <div className="dd-card-actions">
                    {req.status === 'pending' && (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--clr-danger)', borderColor: 'var(--clr-danger)' }}
                        onClick={() => handleDeleteRequest(req.id)}
                      >
                        Delete
                      </button>
                    )}
                    {req.status === 'delivered' && !req.feedback_given && !feedbackFor && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setFeedbackFor(req)}
                      >
                        💬 {t('recipient', 'give_feedback')}
                      </button>
                    )}
                  </div>
                  {feedbackFor?.id === req.id && (
                    <div className="dd-feedback-form">
                      <FeedbackForm
                        requestId={req.id}
                        onClose={() => setFeedbackFor(null)}
                        onSuccess={() => { setFeedbackFor(null); showToast('Feedback submitted!'); fetchAll(); }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <TourKit tour={tour} />
    </div>
  );
}
