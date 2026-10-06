import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from './i18n/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { apiFetch } from './utils/api';
import { API_BASE, APP_ROOT } from './config';
import { SkeletonGrid } from './components/SkeletonCard.jsx';
import Toast from './components/Toast';

function StatusBadge({ status }) {
  const map = {
    available: 'badge badge-green',
    pending:   'badge badge-amber',
    accepted:  'badge badge-blue',
    delivered: 'badge badge-green',
    expired:   'badge badge-red',
    declined:  'badge badge-red',
    claimed:   'badge badge-blue',
    delivering: 'badge badge-blue',
    pending_review: 'badge badge-amber',
    approved:  'badge badge-green',
    rejected:  'badge badge-red',
  };
  return (
    <span className={map[status?.toLowerCase()] || 'badge badge-gray'}>
      {status}
    </span>
  );
}

export default function DonorDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [tab, setTab] = useState('requests');
  const [foodRequests, setFoodRequests] = useState([]);
  const [myDonations, setMyDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [reqSearch, setReqSearch] = useState('');

  // A pending request is urgent when it's needed within the next 3 days
  const isUrgent = (req) => {
    if (req.status !== 'pending' || !req.needed_by) return false;
    const days = (new Date(req.needed_by) - new Date()) / 86400000;
    return days >= -1 && days <= 3;
  };

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, donRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/requests?donor_view=true`).then(r => r.json()),
        apiFetch(`${API_BASE}/api/listings?donor_id=${user?.id}`).then(r => r.json()),
      ]);
      if (reqRes.success) setFoodRequests(reqRes.requests || []);
      if (donRes.success) setMyDonations(donRes.listings || []);
    } catch {
      showToast('Failed to load data.', 'error');
    }
    setLoading(false);
  }, [user, showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRespond = async (requestId, status) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/requests/${requestId}/respond`, {
        method: 'PUT',
        body: JSON.stringify({
          request_id: requestId,
          status,
          user_id: user?.id || 0,
          user_name: user?.name || ''
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Request ${status} successfully!`);
        fetchAll();
      } else {
        showToast(data.detail || data.message || 'Action failed.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }
  };

  const handleShareFeedback = () => {
    showToast('Feedback is visible on the community feedback page.');
  };

  const handleMarkDelivered = async (requestId) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/requests/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ request_id: requestId, status: 'delivered' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Marked as delivered — the recipient has been notified!');
        fetchAll();
      } else {
        showToast(data.detail || data.message || 'Action failed.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }
  };

  const handleDeleteListing = async (listing) => {
    if (!window.confirm(`Delete "${listing.food_name}"? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/listings/${listing.id}?donor_id=${user?.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Listing deleted.');
        fetchAll();
      } else {
        showToast(data.detail || data.message || 'Delete failed.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }
  };

  // Stats
  const pending = foodRequests.filter(r => r.status === 'pending').length;
  const accepted = foodRequests.filter(r => r.status === 'accepted').length;
  const totalListings = myDonations.length;

  const stats = [
    { icon: '📋', value: totalListings, label: t('donor', 'my_listings') },
    { icon: '📬', value: foodRequests.length, label: 'Total Requests' },
    { icon: '⏳', value: pending,   label: 'Pending' },
    { icon: '✅', value: accepted,  label: 'Accepted' },
  ];

  const TABS = [
    { key: 'requests',  label: `📬 Incoming Requests (${foodRequests.length})` },
    { key: 'listings',  label: `🍽️ My Listings (${totalListings})` },
  ];

  return (
    <div className="dashboard-page">
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="dd-header">
        <div>
          <h1 className="dd-title">{t('donor', 'dashboard_title')}</h1>
          <p className="dd-welcome">{t('donor', 'welcome')} <strong>{user?.name}</strong></p>
          <div className="dd-header__chips">
            <span className="dd-impact-chip">📦 {foodRequests.filter(r => r.status === 'delivered').length} delivered</span>
            <span className="dd-impact-chip">🍽️ {totalListings} listing{totalListings !== 1 ? 's' : ''} shared</span>
            {foodRequests.filter(isUrgent).length > 0 && (
              <span className="dd-impact-chip">⚡ {foodRequests.filter(isUrgent).length} urgent request{foodRequests.filter(isUrgent).length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <Link to="/donate" className="btn btn-primary">
          + {t('donor', 'add_listing')}
        </Link>
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
        <SkeletonGrid count={6} />
      ) : (
        <>
          {/* Incoming Requests Tab */}
          {tab === 'requests' && (
            <>
            <div className="dd-search-row">
              <input
                className="form-control"
                type="text"
                placeholder="Filter by food, recipient, location…"
                value={reqSearch}
                onChange={e => setReqSearch(e.target.value)}
                style={{ maxWidth: 320 }}
              />
              {reqSearch && (
                <button className="btn btn-outline btn-sm" onClick={() => setReqSearch('')}>✕ Clear</button>
              )}
            </div>
            <div className="cards-grid">
              {foodRequests.length === 0 ? (
                <div className="dd-empty">
                  <span className="dd-empty__icon">📭</span>
                  <p>{t('donor', 'no_requests')}</p>
                </div>
              ) : foodRequests
                  .filter(req => {
                    if (!reqSearch) return true;
                    const q = reqSearch.toLowerCase();
                    return [req.food_item, req.recipient_name, req.location]
                      .some(v => (v || '').toLowerCase().includes(q));
                  })
                  .map(req => (
                <div key={req.id} className={`dashboard-card dd-status-${req.status}`}>
                  <div className="dd-card-top">
                    {req.image_path && (
                      <img
                        className="dd-card-img"
                        src={`${APP_ROOT}${req.image_path}`}
                        alt={req.food_item}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="dd-card-info">
                      <div className="dd-card-title">
                        {req.food_item}
                        {isUrgent(req) && <span className="dd-urgent-chip">⚡ urgent</span>}
                      </div>
                      <p className="dd-card-meta">👤 {req.recipient_name}</p>
                      <p className="dd-card-meta">📦 {req.quantity}</p>
                      <p className="dd-card-meta">📍 {req.location}</p>
                      {req.needed_by && (
                        <p className="dd-card-meta">📅 Needed by: {req.needed_by}</p>
                      )}
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  {req.status === 'pending' && (
                    <div className="dd-card-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRespond(req.id, 'accepted')}
                      >
                        {t('donor', 'accept_request')}
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ '--btn-color': 'var(--clr-danger)' }}
                        onClick={() => handleRespond(req.id, 'declined')}
                      >
                        {t('donor', 'decline_request')}
                      </button>
                    </div>
                  )}
                  {req.status === 'accepted' && (
                    <div className="dd-card-actions">
                      <p className="dd-accepted-msg" style={{ margin: 0 }}>✓ {t('donor', 'accept_request')}ed</p>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleMarkDelivered(req.id)}
                      >
                        📦 Mark Delivered
                      </button>
                    </div>
                  )}
                  {req.status === 'delivered' && (
                    <p className="dd-accepted-msg">📦 Delivered</p>
                  )}
                </div>
              ))}
            </div>
            </>
          )}

          {/* My Listings Tab */}
          {tab === 'listings' && (
            <div className="cards-grid">
              {myDonations.length === 0 ? (
                <div className="dd-empty">
                  <span className="dd-empty__icon">🍽️</span>
                  <p>{t('donor', 'no_listings')}</p>
                  <Link to="/donate" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                    {t('donor', 'add_listing')}
                  </Link>
                </div>
              ) : myDonations.map(don => (
                <div key={don.id} className="dashboard-card">
                  <div className="dd-card-top">
                    {don.image_path && (
                      <img
                        className="dd-card-img"
                        src={`${APP_ROOT}${don.image_path}`}
                        alt={don.food_name}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="dd-card-info">
                      <div className="dd-card-title">{don.food_name}</div>
                      <p className="dd-card-meta">📦 {don.quantity}</p>
                      <p className="dd-card-meta">📅 Expires: {don.expiry_date}</p>
                      <p className="dd-card-meta">📍 {don.location}</p>
                      <p className="dd-card-meta">📊 {don.total_requests || 0} requests</p>
                      {don.verification_status === 'rejected' && don.rejection_reason && (
                        <p className="dd-card-meta" style={{ color: 'var(--clr-danger, #dc2626)' }}>
                          ✕ Rejected: {don.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      <StatusBadge status={don.status} />
                      {don.verification_status && don.verification_status !== 'approved' && (
                        <StatusBadge status={don.verification_status} />
                      )}
                    </div>
                  </div>

                  <div className="dd-card-actions">
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(don.location)}`, '_blank')}
                    >
                      🗺️ View Location
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ '--btn-color': 'var(--clr-danger)' }}
                      onClick={() => handleDeleteListing(don)}
                    >
                      🗑 Delete
                    </button>
                    {don.requests?.length > 0 && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setExpanded(p => ({ ...p, [don.id]: !p[don.id] }))}
                      >
                        {expanded[don.id] ? '▲ Hide' : `▼ ${don.requests.length} Request(s)`}
                      </button>
                    )}
                  </div>

                  {/* Expanded requests */}
                  {expanded[don.id] && don.requests?.map(req => (
                    <div key={req.id} className="dd-sub-card">
                      <div className="dd-sub-header">
                        <span className="dd-sub-title">{req.food_name || don.food_name}</span>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="dd-card-meta">👤 {req.recipient_name}</p>
                      <p className="dd-card-meta">📦 {req.quantity} · 📍 {req.recipient_location || req.location}</p>
                      {req.accepted_at && (
                        <p className="dd-card-meta">✅ Accepted: {new Date(req.accepted_at).toLocaleDateString()}</p>
                      )}
                      {req.feedback_id && (
                        <div className="dd-feedback-box">
                          <p className="dd-feedback-label">💬 Feedback</p>
                          {req.feedback_comment && (
                            <p className="dd-feedback-text">"{req.feedback_comment}"</p>
                          )}
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleShareFeedback(req.feedback_id)}
                          >
                            Share Feedback
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
