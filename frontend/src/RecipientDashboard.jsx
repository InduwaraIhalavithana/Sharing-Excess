import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from './i18n/LanguageContext.jsx';
import { useAuth } from './contexts/AuthContext.jsx';
import { apiFetch } from './utils/api.js';
import { API_BASE, APP_ROOT } from './config.js';
import FeedbackForm from './components/FeedbackForm';

function Toast({ msg, type = 'success', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className={`dd-toast dd-toast--${type}`}>{msg}</div>;
}

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
  const [foodListings, setFoodListings] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Custom request form
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [customReq, setCustomReq] = useState({
    food_name: '', quantity: '', needed_by: '', location: ''
  });

  // Feedback
  const [feedbackFor, setFeedbackFor] = useState(null);

  // Search
  const [search, setSearch] = useState('');

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
  }, []);

  const fetchAll = useCallback(async (searchVal = search) => {
    setLoading(true);
    try {
      const listingUrl = searchVal
        ? `${API_BASE}/api/listings?q=${encodeURIComponent(searchVal)}`
        : `${API_BASE}/api/listings`;
      const [listRes, reqRes] = await Promise.all([
        apiFetch(listingUrl).then(r => r.json()),
        user ? apiFetch(`${API_BASE}/api/requests?recipient_id=${user.id}`).then(r => r.json()) : Promise.resolve({ success: true, requests: [] }),
      ]);
      if (listRes.success) setFoodListings(listRes.listings || []);
      if (reqRes.success) setMyRequests(reqRes.requests || []);
    } catch {
      showToast('Failed to load data.', 'error');
    }
    setLoading(false);
  }, [user, showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRequestListing = async (listing) => {
    if (!user || user.role !== 'recipient') {
      showToast('Please log in as a recipient.', 'error');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('recipient_id', user.id);
      fd.append('food_name', listing.food_name);
      fd.append('quantity', listing.quantity);
      fd.append('needed_by', new Date().toISOString().split('T')[0]);
      fd.append('location', user.location || '');
      const res = await apiFetch(`${API_BASE}/api/requests`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Food request submitted!');
        fetchAll();
      } else {
        showToast(data.detail || data.message || 'Request failed.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    if (!user || user.role !== 'recipient') {
      showToast('Please log in as a recipient.', 'error');
      return;
    }
    setFormLoading(true);
    try {
      const fd = new FormData();
      fd.append('recipient_id', user.id);
      fd.append('food_name', customReq.food_name);
      fd.append('quantity', customReq.quantity);
      fd.append('needed_by', customReq.needed_by);
      fd.append('location', customReq.location);
      const res = await apiFetch(`${API_BASE}/api/requests`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Custom request submitted!');
        setShowForm(false);
        setCustomReq({ food_name: '', quantity: '', needed_by: '', location: '' });
        fetchAll();
      } else {
        showToast(data.detail || data.message || 'Submission failed.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }
    setFormLoading(false);
  };

  const handleDeleteRequest = async (requestId) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/requests/${requestId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setMyRequests(p => p.filter(r => r.id !== requestId));
        showToast('Request deleted.');
      } else {
        showToast(data.detail || data.message || 'Delete failed.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
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
    { key: 'available', label: `${t('recipient', 'available_food')} (${available})` },
    { key: 'requests',  label: `${t('recipient', 'my_requests')} (${myRequests.length})` },
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
        <button className="btn btn-primary" onClick={() => { setShowForm(p => !p); setTab('requests'); }}>
          + {t('recipient', 'request_food')}
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
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
                <input className="form-control" type="text" placeholder="What food do you need?"
                  value={customReq.food_name} onChange={e => setCustomReq(p => ({ ...p, food_name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-control" type="text" placeholder="e.g. 5 kg"
                  value={customReq.quantity} onChange={e => setCustomReq(p => ({ ...p, quantity: e.target.value }))} required />
              </div>
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Needed By</label>
                <input className="form-control" type="date"
                  value={customReq.needed_by} onChange={e => setCustomReq(p => ({ ...p, needed_by: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Location</label>
                <input className="form-control" type="text" placeholder="City / District"
                  value={customReq.location} onChange={e => setCustomReq(p => ({ ...p, location: e.target.value }))} required />
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
      <div className="dd-tabs">
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
        <div className="dd-loading"><span className="dd-spinner" />Loading…</div>
      ) : (
        <>
          {/* Available Listings */}
          {tab === 'available' && (
            <>
              <div className="dd-search-row">
                <input
                  className="form-control"
                  type="text"
                  placeholder="Search food name, location…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); fetchAll(e.target.value); }}
                  style={{ maxWidth: 320 }}
                />
                {search && (
                  <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); fetchAll(''); }}>
                    ✕ Clear
                  </button>
                )}
              </div>
            <div className="cards-grid">
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
                <div key={req.id} className="dashboard-card">
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
                    {req.status === 'delivered' && !feedbackFor && (
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
    </div>
  );
}
