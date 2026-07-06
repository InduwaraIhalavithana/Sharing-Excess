import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from './i18n/LanguageContext.jsx';
import { API_BASE, APP_ROOT } from './config.js';

function Toast({ msg, type = 'success', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={`dd-toast dd-toast--${type}`}>{msg}</div>
  );
}

function StatusBadge({ status }) {
  const map = {
    available: 'badge badge-green',
    pending:   'badge badge-amber',
    accepted:  'badge badge-blue',
    delivered: 'badge badge-green',
    expired:   'badge badge-red',
    declined:  'badge badge-red',
    claimed:   'badge badge-blue',
  };
  return (
    <span className={map[status?.toLowerCase()] || 'badge badge-gray'}>
      {status}
    </span>
  );
}

export default function DonorDashboard() {
  const { t } = useLanguage();
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [tab, setTab] = useState('requests');
  const [foodRequests, setFoodRequests] = useState([]);
  const [myDonations, setMyDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [expanded, setExpanded] = useState({});

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, donRes] = await Promise.all([
        fetch(`${API_BASE}/get_requests.php?donor_view=true`).then(r => r.json()),
        fetch(`${API_BASE}/get_donor_donations.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ donor_id: user?.id })
        }).then(r => r.json()),
      ]);
      if (reqRes.success) setFoodRequests(reqRes.requests || []);
      if (donRes.success) setMyDonations(donRes.donations || []);
    } catch {
      showToast('Failed to load data.', 'error');
    }
    setLoading(false);
  }, [user, showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRespond = async (requestId, status) => {
    try {
      const res = await fetch(`${API_BASE}/respond_to_request.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          status,
          user_id: user?.id,
          user_name: user?.name
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Request ${status} successfully!`);
        fetchAll();
      } else {
        showToast(data.message || 'Action failed.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }
  };

  const handleShareFeedback = async (feedbackId) => {
    try {
      const res = await fetch(`${API_BASE}/share_feedback.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_id: feedbackId, donor_id: user?.id })
      });
      const data = await res.json();
      if (data.success) showToast('Feedback shared to the feedback page!');
      else showToast(data.message || 'Failed to share feedback.', 'error');
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
    { key: 'requests',  label: `Incoming Requests (${foodRequests.length})` },
    { key: 'listings',  label: `My Listings (${totalListings})` },
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
        <div className="dd-loading">
          <span className="dd-spinner" />
          Loading…
        </div>
      ) : (
        <>
          {/* Incoming Requests Tab */}
          {tab === 'requests' && (
            <div className="cards-grid">
              {foodRequests.length === 0 ? (
                <div className="dd-empty">
                  <span className="dd-empty__icon">📭</span>
                  <p>{t('donor', 'no_requests')}</p>
                </div>
              ) : foodRequests.map(req => (
                <div key={req.id} className="dashboard-card">
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
                      <div className="dd-card-title">{req.food_item}</div>
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
                    <p className="dd-accepted-msg">✓ {t('donor', 'accept_request')}ed</p>
                  )}
                </div>
              ))}
            </div>
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
                    </div>
                    <StatusBadge status={don.status} />
                  </div>

                  <div className="dd-card-actions">
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(don.location)}`, '_blank')}
                    >
                      🗺️ View Location
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
