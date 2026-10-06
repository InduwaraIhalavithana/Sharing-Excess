import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Pie, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement, PointElement, LineElement
} from 'chart.js';
import { useLanguage } from './i18n/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { apiFetch } from './utils/api';
import { API_BASE } from './config';
import Toast from './components/Toast';
import { TourKit, useTour } from './components/tour/TourKit';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement
);

function StatusBadge({ status }) {
  const map = {
    pending:   'badge badge-amber',
    accepted:  'badge badge-blue',
    delivered: 'badge badge-green',
    declined:  'badge badge-red',
    available: 'badge badge-green',
    expired:   'badge badge-red',
    active:    'badge badge-green',
    inactive:  'badge badge-gray',
    suspended: 'badge badge-red',
    donor:     'badge badge-green',
    recipient: 'badge badge-blue',
    admin:     'badge badge-red',
    open:      'badge badge-amber',
    resolved:  'badge badge-green',
    pending_review: 'badge badge-amber',
    approved:  'badge badge-green',
    rejected:  'badge badge-red',
    actioned:  'badge badge-green',
    dismissed: 'badge badge-gray',
    adminofficer: 'badge badge-blue',
  };
  return (
    <span className={map[status?.toLowerCase()] || 'badge badge-gray'}>
      {status}
    </span>
  );
}

function EditableCell({ value, onSave, type = 'text', options }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  if (!editing) return (
    <span className="od-editable" onClick={() => setEditing(true)} title="Click to edit">
      {value || '—'}
    </span>
  );
  return (
    <span className="od-edit-row">
      {options ? (
        <select className="od-edit-input" value={val} onChange={e => setVal(e.target.value)}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input className="od-edit-input" type={type} value={val} onChange={e => setVal(e.target.value)} autoFocus />
      )}
      <button className="od-edit-save" onClick={() => { onSave(val); setEditing(false); }}>✓</button>
      <button className="od-edit-cancel" onClick={() => { setVal(value); setEditing(false); }}>✕</button>
    </span>
  );
}

const NAV_ITEMS = [
  { key: 'overview',    icon: '📊', label: 'Overview' },
  { key: 'verify',      icon: '✅', label: 'Verify Listings' },
  { key: 'requests',    icon: '📬', label: 'Requests' },
  { key: 'listings',    icon: '🍽️', label: 'Listings' },
  { key: 'users',       icon: '👥', label: 'Users' },
  { key: 'money',       icon: '💰', label: 'Money Donations' },
  { key: 'feedback',    icon: '💬', label: 'Feedback' },
  { key: 'escalations', icon: '🚩', label: 'Escalations' },
  { key: 'reports',     icon: '📈', label: 'Reports' },
];

export default function OfficerDashboard() {
  const { t } = useLanguage();
  const { user: adminUser, logout } = useAuth();
  const navigate = useNavigate();

  const tour = useTour('admin');
  const [tab, setTab]               = useState('overview');
  const [requests, setRequests]     = useState([]);
  const [listings, setListings]     = useState([]);
  const [users, setUsers]           = useState([]);
  const [moneyDon, setMoneyDon]     = useState([]);
  const [feedback, setFeedback]     = useState([]);
  const [pending, setPending]       = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [fbFilter, setFbFilter]     = useState('open');
  const [fbReply, setFbReply]       = useState({ open: false, item: null, text: '' });
  const [rejectModal, setRejectModal] = useState({ open: false, listing: null, reason: '' });
  const [flagModal, setFlagModal]   = useState({ open: false, targetType: null, targetId: null, label: '', reason: '' });
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const staffCalls = [
        apiFetch(`${API_BASE}/api/officer/requests`).then(r => r.json()),
        apiFetch(`${API_BASE}/api/officer/listings`).then(r => r.json()),
        apiFetch(`${API_BASE}/api/officer/feedback`).then(r => r.json()),
        apiFetch(`${API_BASE}/api/officer/stats`).then(r => r.json()),
        apiFetch(`${API_BASE}/api/officer/listings/pending`).then(r => r.json()),
        apiFetch(`${API_BASE}/api/officer/escalations`).then(r => r.json()),
        apiFetch(`${API_BASE}/api/officer/users`).then(r => r.json()),
        apiFetch(`${API_BASE}/api/officer/donations/money`).then(r => r.json()),
      ];
      const [rr, lr, fr, sr, pr, er, ur, mr] = await Promise.all(staffCalls);
      if (rr.success) setRequests(rr.requests || []);
      if (lr.success) setListings(lr.listings || []);
      if (fr.success) setFeedback(fr.feedback || []);
      if (sr.success) setStats(sr);
      if (pr.success) setPending(pr.listings || []);
      if (er.success) setEscalations(er.escalations || []);
      if (ur.success) setUsers(ur.users || []);
      if (mr.success) setMoneyDon(mr.donations || []);
    } catch {
      showToast('Failed to load data.', 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Guard: only staff accounts may view this dashboard
  useEffect(() => {
    if (!adminUser || String(adminUser.role || '').toLowerCase() !== 'adminofficer') {
      navigate('/');
    }
  }, [adminUser, navigate]);

  const updateRequest = async (id, updates) => {
    try {
      const d = await apiFetch(`${API_BASE}/api/officer/requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      }).then(r => r.json());
      if (d.success) { showToast('Request updated.'); fetchAll(); }
      else showToast(d.message || d.detail || 'Update failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
  };

  const deleteItem = async () => {
    if (!confirmDel) return;
    const { type, id } = confirmDel;
    setConfirmDel(null);
    const url = type === 'request'
      ? `${API_BASE}/api/officer/requests/${id}`
      : `${API_BASE}/api/officer/listings/${id}`;
    try {
      const d = await apiFetch(url, { method: 'DELETE' }).then(r => r.json());
      if (d.success) {
        showToast('Deleted successfully.');
        if (type === 'request') setRequests(p => p.filter(r => r.id !== id));
        else setListings(p => p.filter(l => l.id !== id));
      } else {
        showToast(d.message || d.detail || 'Delete failed.', 'error');
      }
    } catch { showToast('Network error.', 'error'); }
  };

  const updateListing = async (id, updates) => {
    try {
      const d = await apiFetch(`${API_BASE}/api/officer/listings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      }).then(r => r.json());
      if (d.success) { showToast('Listing updated.'); fetchAll(); }
      else showToast(d.message || d.detail || 'Update failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
  };

  const suspendUser = async (u) => {
    try {
      const d = await apiFetch(`${API_BASE}/api/officer/users/${u.id}/suspend`, {
        method: 'PATCH'
      }).then(r => r.json());
      if (d.success) {
        showToast(`${u.name} ${d.status === 'suspended' ? 'suspended' : 'unsuspended'}.`);
        fetchAll();
      } else showToast(d.message || d.detail || 'Failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try {
      const d = await apiFetch(`${API_BASE}/api/officer/users/${u.id}`, {
        method: 'DELETE'
      }).then(r => r.json());
      if (d.success) { showToast(`${u.name} deleted.`); fetchAll(); }
      else showToast(d.message || d.detail || 'Failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
  };

  const resolveFeedback = async () => {
    const { item, text } = fbReply;
    try {
      const d = await apiFetch(`${API_BASE}/api/officer/feedback/${item.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ reply: text })
      }).then(r => r.json());
      if (d.success) {
        showToast('Feedback resolved.');
        setFbReply({ open: false, item: null, text: '' });
        fetchAll();
      } else showToast(d.message || d.detail || 'Failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
  };

  const reopenFeedback = async (id) => {
    try {
      const d = await apiFetch(`${API_BASE}/api/officer/feedback/${id}/reopen`, {
        method: 'PATCH'
      }).then(r => r.json());
      if (d.success) { showToast('Feedback reopened.'); fetchAll(); }
      else showToast(d.message || d.detail || 'Failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
  };

  const verifyListing = async (id, action, reason = '') => {
    try {
      const d = await apiFetch(`${API_BASE}/api/officer/listings/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ action, reason })
      }).then(r => r.json());
      if (d.success) {
        showToast(action === 'approve' ? 'Listing approved — now public.' : 'Listing rejected.');
        setRejectModal({ open: false, listing: null, reason: '' });
        fetchAll();
      } else showToast(d.message || d.detail || 'Failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
  };

  const createEscalation = async () => {
    const { targetType, targetId, reason } = flagModal;
    if (!reason.trim()) { showToast('Please give a reason.', 'error'); return; }
    try {
      const d = await apiFetch(`${API_BASE}/api/officer/escalations`, {
        method: 'POST',
        body: JSON.stringify({ target_type: targetType, target_id: targetId, reason })
      }).then(r => r.json());
      if (d.success) {
        showToast('Flagged to admin.');
        setFlagModal({ open: false, targetType: null, targetId: null, label: '', reason: '' });
        fetchAll();
      } else showToast(d.message || d.detail || 'Failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
  };

  const updateEscalation = async (id, status) => {
    try {
      const d = await apiFetch(`${API_BASE}/api/officer/escalations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }).then(r => r.json());
      if (d.success) { showToast(`Escalation ${status}.`); fetchAll(); }
      else showToast(d.message || d.detail || 'Failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
  };

  const deleteFeedback = async (id) => {
    if (!window.confirm('Delete this feedback permanently?')) return;
    try {
      const d = await apiFetch(`${API_BASE}/api/officer/feedback/${id}`, {
        method: 'DELETE'
      }).then(r => r.json());
      if (d.success) { showToast('Feedback deleted.'); fetchAll(); }
      else showToast(d.message || d.detail || 'Failed.', 'error');
    } catch { showToast('Network error.', 'error'); }
  };

  const openFlag = (targetType, targetId, label) =>
    setFlagModal({ open: true, targetType, targetId, label, reason: '' });

  const exportCSV = () => {
    if (!stats) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Requests',     stats.total_requests],
      ['Total Listings',     stats.total_listings],
      ['Total Users',        stats.total_users],
      ['Money Donations',    stats.total_money_donations],
      [''],
      ['Requests by Status', ''],
      ...Object.entries(stats.requests_by_status || {}).map(([k, v]) => [k, v]),
      [''],
      ['Users by Role', ''],
      ...Object.entries(stats.users_by_role || {}).map(([k, v]) => [k, v]),
      [''],
      ['Top Requested Foods', ''],
      ...(stats.top_requested_foods || []).map(f => [f.name, f.count]),
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'sharing-excess-report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Chart data
  const foodCount = {};
  requests.forEach(r => {
    const n = r.food_name || r.food_item || 'Unknown';
    foodCount[n] = (foodCount[n] || 0) + 1;
  });
  const topFoods = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const distByMonth = {};
  requests.filter(r => r.status === 'accepted').forEach(r => {
    const d = new Date(r.created_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    distByMonth[k] = (distByMonth[k] || 0) + 1;
  });
  const distLabels = Object.keys(distByMonth).sort();

  const donorCount     = users.filter(u => u.role === 'donor').length;
  const recipientCount = users.filter(u => u.role === 'recipient').length;
  const chartColors    = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0'];
  const chartOpts      = { responsive: true, plugins: { legend: { position: 'bottom' } } };

  const openFeedbackCount = feedback.filter(f => f.feedback_status === 'open').length;
  const openEscalationCount = escalations.filter(e => e.status === 'open').length;

  // Merge the latest platform events into one activity feed
  const recentActivity = [
    ...requests.map(r => ({
      key: `req-${r.id}`, icon: '📬', when: r.created_at, status: r.status,
      text: `${r.recipient_name || 'A recipient'} requested ${r.food_name || r.food_item}`,
    })),
    ...listings.map(l => ({
      key: `list-${l.id}`, icon: '🍽️', when: l.created_at, status: l.verification_status || l.status,
      text: `${l.donor_name || 'A donor'} listed ${l.food_name}`,
    })),
    ...feedback.map(f => ({
      key: `fb-${f.id}`, icon: '💬', when: f.created_at, status: f.feedback_status,
      text: `${f.recipient_name || 'Someone'} left feedback${f.rating ? ` (${'⭐'.repeat(Math.min(f.rating, 5))})` : ''}`,
    })),
    ...escalations.map(e => ({
      key: `esc-${e.id}`, icon: '🚩', when: e.created_at, status: e.status,
      text: `${e.officer_name || 'An officer'} flagged ${e.target_type} #${e.target_id}`,
    })),
  ]
    .filter(a => a.when)
    .sort((a, b) => new Date(b.when) - new Date(a.when))
    .slice(0, 8);

  const filteredFeedback = feedback.filter(f =>
    fbFilter === 'all' ? true : f.feedback_status === fbFilter
  );

  const filteredUsers = users.filter(u => {
    const q          = userSearch.toLowerCase();
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchRole   = !userRoleFilter || u.role === userRoleFilter;
    return matchSearch && matchRole;
  });

  const initials     = adminUser?.name
    ? adminUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';
  const currentLabel = NAV_ITEMS.find(n => n.key === tab)?.label || 'Dashboard';

  return (
    <div className="ad-shell">
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="modal-close" onClick={() => setConfirmDel(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Are you sure? This cannot be undone.</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" onClick={deleteItem}>Delete</button>
                <button className="btn btn-outline" onClick={() => setConfirmDel(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback reply modal */}
      {fbReply.open && (
        <div className="modal-overlay" onClick={() => setFbReply({ open: false, item: null, text: '' })}>
          <div className="modal-box" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reply &amp; Resolve</h2>
              <button className="modal-close" onClick={() => setFbReply({ open: false, item: null, text: '' })}>✕</button>
            </div>
            <div className="modal-body">
              <div className="ad-fb-preview">
                <p className="ad-fb-preview__from">
                  From <strong>{fbReply.item?.recipient_name}</strong>
                  {fbReply.item?.rating && <span> · {'⭐'.repeat(fbReply.item.rating)}</span>}
                </p>
                <p className="ad-fb-preview__comment">{fbReply.item?.comment}</p>
              </div>
              <textarea
                rows={4}
                value={fbReply.text}
                onChange={e => setFbReply(p => ({ ...p, text: e.target.value }))}
                placeholder="Type your reply (optional)…"
                className="ad-fb-textarea"
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setFbReply({ open: false, item: null, text: '' })}>Cancel</button>
                <button className="btn btn-primary" onClick={resolveFeedback}>✓ Mark Resolved</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject listing modal */}
      {rejectModal.open && (
        <div className="modal-overlay" onClick={() => setRejectModal({ open: false, listing: null, reason: '' })}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Listing</h2>
              <button className="modal-close" onClick={() => setRejectModal({ open: false, listing: null, reason: '' })}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
                Rejecting <strong>{rejectModal.listing?.food_name}</strong>. The donor will see this reason.
              </p>
              <textarea
                rows={3}
                value={rejectModal.reason}
                onChange={e => setRejectModal(p => ({ ...p, reason: e.target.value }))}
                placeholder="e.g., Expiry date too close, unclear photo, unsafe food type…"
                className="ad-fb-textarea"
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setRejectModal({ open: false, listing: null, reason: '' })}>Cancel</button>
                <button className="btn btn-primary" onClick={() => verifyListing(rejectModal.listing.id, 'reject', rejectModal.reason)}>Reject Listing</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flag-to-admin modal */}
      {flagModal.open && (
        <div className="modal-overlay" onClick={() => setFlagModal({ open: false, targetType: null, targetId: null, label: '', reason: '' })}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🚩 Flag to Admin</h2>
              <button className="modal-close" onClick={() => setFlagModal({ open: false, targetType: null, targetId: null, label: '', reason: '' })}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
                Escalating <strong>{flagModal.label}</strong> ({flagModal.targetType} #{flagModal.targetId}) to the admin.
              </p>
              <textarea
                rows={3}
                value={flagModal.reason}
                onChange={e => setFlagModal(p => ({ ...p, reason: e.target.value }))}
                placeholder="Why does this need admin attention?"
                className="ad-fb-textarea"
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setFlagModal({ open: false, targetType: null, targetId: null, label: '', reason: '' })}>Cancel</button>
                <button className="btn btn-primary" onClick={createEscalation}>🚩 Send to Admin</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className="ad-sidebar">
        <div className="ad-sidebar__brand">
          <div className="ad-sidebar__brand-icon">🌿</div>
          <div>
            <div className="ad-sidebar__brand-name">Sharing Excess</div>
            <div className="ad-sidebar__brand-sub">Admin Panel</div>
          </div>
        </div>

        <nav className="ad-sidebar__nav" data-tour="admin-nav">
          {NAV_ITEMS.map(({ key, icon, label }) => (
            <button
              key={key}
              data-tour={key === 'verify' ? 'admin-verify' : undefined}
              className={`ad-sidebar__link${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              <span className="ad-sidebar__link-icon">{icon}</span>
              <span>{label}</span>
              {key === 'feedback' && openFeedbackCount > 0 && (
                <span className="ad-sidebar__badge">{openFeedbackCount}</span>
              )}
              {key === 'verify' && pending.length > 0 && (
                <span className="ad-sidebar__badge">{pending.length}</span>
              )}
              {key === 'escalations' && openEscalationCount > 0 && (
                <span className="ad-sidebar__badge">{openEscalationCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="ad-sidebar__user">
          <div className="ad-sidebar__user-avatar">{initials}</div>
          <div className="ad-sidebar__user-info">
            <div className="ad-sidebar__user-name">{adminUser?.name || 'Staff'}</div>
            <div className="ad-sidebar__user-role">Admin Officer</div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="ad-main">
        <header className="ad-topbar">
          <div className="ad-topbar__title">{currentLabel}</div>
          <div className="ad-topbar__right">
            <button className="ad-refresh-btn" data-tour="admin-refresh" onClick={fetchAll} title="Refresh data">↻ Refresh</button>
            <button className="ad-logout-btn" onClick={handleLogout}>🚪 Logout</button>
          </div>
        </header>

        <main className="ad-content">
          {loading ? (
            <div className="dd-loading"><span className="dd-spinner" />Loading…</div>
          ) : (
            <>

              {/* ═══ OVERVIEW ═══════════════════════════════════════════════════ */}
              {tab === 'overview' && (
                <div>
                  <div className="stats-grid" data-tour="admin-stats" style={{ marginBottom: 28 }}>
                    {[
                      { icon: '📬', value: requests.length,                                          label: 'Total Requests',   color: '#16a34a' },
                      { icon: '🍽️', value: listings.length,                                         label: 'Food Listings',    color: '#2563eb' },
                      { icon: '✅', value: pending.length,                                           label: 'Awaiting Review',  color: '#ea580c' },
                      { icon: '🚩', value: openEscalationCount,                                      label: 'Open Escalations', color: '#dc2626' },
                      { icon: '📦', value: requests.filter(r => r.status === 'delivered').length,    label: 'Delivered',        color: '#059669' },
                      { icon: '⏳', value: requests.filter(r => r.status === 'pending').length,      label: 'Pending',          color: '#f59e0b' },
                      { icon: '💬', value: openFeedbackCount,                                        label: 'Open Feedback',    color: '#dc2626' },
                      { icon: '👥', value: users.length,    label: 'Registered Users', color: '#7c3aed' },
                      { icon: '💰', value: moneyDon.length, label: 'Money Donations',  color: '#d97706' },
                      { icon: '💵', value: 'LKR ' + moneyDon.reduce((s, m) => s + Number(m.amount || 0), 0).toLocaleString(), label: 'Total Raised', color: '#0891b2' },
                    ].map(s => (
                      <div key={s.label} className="dashboard-card stat-card">
                        <span className="stat-card__icon">{s.icon}</span>
                        <span className="stat-card__value" style={{ color: s.color }}>{s.value}</span>
                        <span className="stat-card__label">{s.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="od-charts">
                    <div className="od-chart-card">
                      <h3 className="od-chart-title">Top Requested Foods</h3>
                      {topFoods.length > 0 ? (
                        <Bar data={{ labels: topFoods.map(([n]) => n), datasets: [{ label: 'Requests', data: topFoods.map(([, c]) => c), backgroundColor: chartColors }] }} options={chartOpts} />
                      ) : <p className="dd-empty-sm">No data yet.</p>}
                    </div>
                    <div className="od-chart-card">
                      <h3 className="od-chart-title">User Distribution</h3>
                      <Pie
                        data={{ labels: ['Donors', 'Recipients'], datasets: [{ data: [donorCount, recipientCount], backgroundColor: ['#16a34a', '#3b82f6'] }] }}
                        options={chartOpts}
                      />
                    </div>
                    <div className="od-chart-card od-chart-card--wide">
                      <h3 className="od-chart-title">Accepted Distributions by Month</h3>
                      {distLabels.length > 0 ? (
                        <Line data={{ labels: distLabels, datasets: [{ label: 'Distributions', data: distLabels.map(m => distByMonth[m]), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.12)', fill: true, tension: 0.4 }] }} options={chartOpts} />
                      ) : <p className="dd-empty-sm">No accepted distributions yet.</p>}
                    </div>
                  </div>

                  {/* Recent activity feed */}
                  <div className="ad-activity">
                    <h3 className="od-chart-title">🕐 Recent Activity</h3>
                    {recentActivity.length === 0 ? (
                      <p className="dd-empty-sm">No activity yet.</p>
                    ) : (
                      <div className="ad-activity__list">
                        {recentActivity.map(a => (
                          <div key={a.key} className="ad-activity__item">
                            <span className="ad-activity__icon">{a.icon}</span>
                            <div className="ad-activity__text">
                              <span>{a.text}</span>
                              <small>{a.when ? new Date(a.when).toLocaleString() : ''}</small>
                            </div>
                            <StatusBadge status={a.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ VERIFY LISTINGS ═════════════════════════════════════════════ */}
              {tab === 'verify' && (
                <div>
                  {pending.length === 0 ? (
                    <div className="dashboard-card" style={{ textAlign: 'center', padding: 40 }}>
                      <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
                      <p style={{ color: 'var(--text-secondary)' }}>No listings waiting for review. All caught up!</p>
                    </div>
                  ) : (
                    <div className="ad-fb-list">
                      {pending.map(l => (
                        <div key={l.id} className="ad-fb-card">
                          <div className="ad-fb-card__header">
                            <div className="ad-fb-card__user">
                              <div className="ad-fb-card__avatar">🍽️</div>
                              <div>
                                <div className="ad-fb-card__name">{l.food_name}</div>
                                <div className="ad-fb-card__meta">
                                  <span>{l.donor_name}</span>
                                  <span>{l.quantity}</span>
                                  {l.expiry_date && <span>Expires {l.expiry_date}</span>}
                                  {l.location && <span>📍 {l.location}</span>}
                                </div>
                              </div>
                            </div>
                            <StatusBadge status="pending_review" />
                          </div>
                          {l.description && <p className="ad-fb-card__comment">{l.description}</p>}
                          {l.image_path && (
                            <img
                              src={`${API_BASE.replace('/api', '')}/uploads/${l.image_path.split('/').pop()}`}
                              alt={l.food_name}
                              className="ad-fb-card__img"
                            />
                          )}
                          <div className="ad-fb-card__actions">
                            <button className="btn btn-sm ad-btn-success" onClick={() => verifyListing(l.id, 'approve')}>
                              ✓ Approve
                            </button>
                            <button className="btn btn-sm ad-btn-danger" onClick={() => setRejectModal({ open: true, listing: l, reason: '' })}>
                              ✕ Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ ESCALATIONS ═════════════════════════════════════════════════ */}
              {tab === 'escalations' && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Items flagged for follow-up by the team. Take action or dismiss.
                  </p>
                  {escalations.length === 0 ? (
                    <div className="dashboard-card" style={{ textAlign: 'center', padding: 40 }}>
                      <div style={{ fontSize: 40, marginBottom: 8 }}>🚩</div>
                      <p style={{ color: 'var(--text-secondary)' }}>No escalations yet.</p>
                    </div>
                  ) : (
                    <div className="ad-fb-list">
                      {escalations.map(e => (
                        <div key={e.id} className={`ad-fb-card${e.status !== 'open' ? ' resolved' : ''}`}>
                          <div className="ad-fb-card__header">
                            <div className="ad-fb-card__user">
                              <div className="ad-fb-card__avatar">🚩</div>
                              <div>
                                <div className="ad-fb-card__name">
                                  {e.target_type} #{e.target_id}
                                </div>
                                <div className="ad-fb-card__meta">
                                  <span>Flagged by {e.officer_name || 'staff'}</span>
                                  <span>{new Date(e.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <StatusBadge status={e.status} />
                          </div>
                          <p className="ad-fb-card__comment">{e.reason}</p>
                          {e.admin_note && (
                            <div className="ad-fb-card__reply">
                              <div className="ad-fb-card__reply-label">Admin note</div>
                              <p>{e.admin_note}</p>
                            </div>
                          )}
                          {e.status === 'open' && (
                            <div className="ad-fb-card__actions">
                              <button className="btn btn-sm ad-btn-success" onClick={() => updateEscalation(e.id, 'actioned')}>
                                ✓ Mark Actioned
                              </button>
                              <button className="btn btn-sm ad-btn-warn" onClick={() => updateEscalation(e.id, 'dismissed')}>
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ REQUESTS ════════════════════════════════════════════════════ */}
              {tab === 'requests' && (
                <div className="od-table-wrap">
                  <table className="od-table">
                    <thead>
                      <tr><th>ID</th><th>Food</th><th>Recipient</th><th>Qty</th><th>Location</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {requests.map(r => (
                        <tr key={r.id}>
                          <td>{r.id}</td>
                          <td>{r.food_name || r.food_item}</td>
                          <td>{r.recipient_name}</td>
                          <td><EditableCell value={r.quantity} onSave={v => updateRequest(r.id, { quantity: v })} /></td>
                          <td>{r.location}</td>
                          <td><EditableCell value={r.status} options={['pending','accepted','delivering','delivered','declined']} onSave={v => updateRequest(r.id, { status: v })} /></td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-sm ad-btn-danger" onClick={() => setConfirmDel({ type: 'request', id: r.id })}>Delete</button>
                              <button className="btn btn-sm ad-btn-warn" onClick={() => openFlag('request', r.id, r.food_name || r.food_item)}>🚩 Flag</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {requests.length === 0 && <p className="dd-empty-sm">No requests found.</p>}
                </div>
              )}

              {/* ═══ LISTINGS ════════════════════════════════════════════════════ */}
              {tab === 'listings' && (
                <div className="od-table-wrap">
                  <table className="od-table">
                    <thead>
                      <tr><th>ID</th><th>Food Name</th><th>Donor</th><th>Qty</th><th>Expiry</th><th>Status</th><th>Verification</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {listings.map(l => (
                        <tr key={l.id}>
                          <td>{l.id}</td>
                          <td>{l.food_name}</td>
                          <td>{l.donor_name}</td>
                          <td><EditableCell value={l.quantity} onSave={v => updateListing(l.id, { quantity: v })} /></td>
                          <td>{l.expiry_date}</td>
                          <td><EditableCell value={l.status} options={['available','claimed','expired']} onSave={v => updateListing(l.id, { status: v })} /></td>
                          <td><StatusBadge status={l.verification_status} /></td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-sm ad-btn-danger" onClick={() => setConfirmDel({ type: 'listing', id: l.id })}>Delete</button>
                              <button className="btn btn-sm ad-btn-warn" onClick={() => openFlag('listing', l.id, l.food_name)}>🚩 Flag</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {listings.length === 0 && <p className="dd-empty-sm">No listings found.</p>}
                </div>
              )}

              {/* ═══ USERS ═══════════════════════════════════════════════════════ */}
              {tab === 'users' && (
                <div>
                  <div className="ad-filter-row">
                    <input
                      className="ad-search-input"
                      type="text"
                      placeholder="Search name or email…"
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                    />
                    <select
                      className="ad-role-select"
                      value={userRoleFilter}
                      onChange={e => setUserRoleFilter(e.target.value)}
                    >
                      <option value="">All roles</option>
                      <option value="donor">Donor</option>
                      <option value="recipient">Recipient</option>
                    </select>
                    <span className="ad-filter-count">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="od-table-wrap">
                    <table className="od-table">
                      <thead>
                        <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => (
                          <tr key={u.id}>
                            <td>{u.id}</td>
                            <td style={{ fontWeight: 600 }}>{u.name}</td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.email}</td>
                            <td><StatusBadge status={u.role} /></td>
                            <td><StatusBadge status={u.status} /></td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  className={`btn btn-sm ${u.status === 'suspended' ? 'ad-btn-success' : 'ad-btn-warn'}`}
                                  onClick={() => suspendUser(u)}
                                >
                                  {u.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                                </button>
                                <button className="btn btn-sm ad-btn-danger" onClick={() => deleteUser(u)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredUsers.length === 0 && <p className="dd-empty-sm">No users found.</p>}
                  </div>
                </div>
              )}

              {/* ═══ MONEY DONATIONS ═════════════════════════════════════════════ */}
              {tab === 'money' && (
                <div>
                  <div className="ad-money-total">
                    💵 Total raised: <strong>LKR {moneyDon.reduce((s, m) => s + Number(m.amount || 0), 0).toLocaleString()}</strong>
                  </div>
                  <div className="od-table-wrap">
                    <table className="od-table">
                      <thead>
                        <tr><th>ID</th><th>Name</th><th>Email</th><th>Amount</th><th>Card</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {moneyDon.map(m => (
                          <tr key={m.id}>
                            <td>{m.id}</td>
                            <td style={{ fontWeight: 600 }}>{m.name || '—'}</td>
                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.email || '—'}</td>
                            <td style={{ fontWeight: 600, color: '#16a34a' }}>LKR {Number(m.amount).toLocaleString()}</td>
                            <td>•••• {m.card_last4}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(m.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {moneyDon.length === 0 && <p className="dd-empty-sm">No donations found.</p>}
                  </div>
                </div>
              )}

              {/* ═══ FEEDBACK ════════════════════════════════════════════════════ */}
              {tab === 'feedback' && (
                <div>
                  <div className="ad-fb-tabs">
                    {[['open','Open'],['resolved','Resolved'],['all','All']].map(([val, label]) => (
                      <button
                        key={val}
                        className={`ad-fb-tab${fbFilter === val ? ' active' : ''}`}
                        onClick={() => setFbFilter(val)}
                      >
                        {label}
                        {val === 'open' && openFeedbackCount > 0 && (
                          <span className="ad-fb-tab-count">{openFeedbackCount}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {filteredFeedback.length === 0 ? (
                    <p className="dd-empty-sm">No feedback in this category.</p>
                  ) : (
                    <div className="ad-fb-list">
                      {filteredFeedback.map(f => (
                        <div key={f.id} className={`ad-fb-card${f.feedback_status === 'resolved' ? ' resolved' : ''}`}>
                          <div className="ad-fb-card__header">
                            <div className="ad-fb-card__user">
                              <div className="ad-fb-card__avatar">{f.recipient_name?.charAt(0)?.toUpperCase() || '?'}</div>
                              <div>
                                <div className="ad-fb-card__name">{f.recipient_name}</div>
                                <div className="ad-fb-card__meta">
                                  {f.rating && <span>{'⭐'.repeat(f.rating)}</span>}
                                  <span>{new Date(f.created_at).toLocaleDateString()}</span>
                                  {f.request_id && <span>Request #{f.request_id}</span>}
                                </div>
                              </div>
                            </div>
                            <StatusBadge status={f.feedback_status} />
                          </div>

                          <p className="ad-fb-card__comment">{f.comment}</p>

                          {f.image_path && (
                            <img
                              src={`${API_BASE.replace('/api', '')}/uploads/${f.image_path.split('/').pop()}`}
                              alt="Feedback"
                              className="ad-fb-card__img"
                            />
                          )}

                          {f.admin_reply && (
                            <div className="ad-fb-card__reply">
                              <div className="ad-fb-card__reply-label">Admin reply</div>
                              <p>{f.admin_reply}</p>
                            </div>
                          )}

                          <div className="ad-fb-card__actions">
                            {f.feedback_status === 'open' ? (
                              <button className="btn btn-sm btn-primary" onClick={() => setFbReply({ open: true, item: f, text: '' })}>
                                💬 Reply &amp; Resolve
                              </button>
                            ) : (
                              <button className="btn btn-sm ad-btn-warn" onClick={() => reopenFeedback(f.id)}>
                                ↺ Reopen
                              </button>
                            )}
                            <button className="btn btn-sm ad-btn-danger" onClick={() => deleteFeedback(f.id)}>
                              🗑 Delete
                            </button>
                            <button className="btn btn-sm ad-btn-warn" onClick={() => openFlag('feedback', f.id, `feedback from ${f.recipient_name}`)}>
                              🚩 Flag
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ REPORTS ═════════════════════════════════════════════════════ */}
              {tab === 'reports' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                    <button className="btn btn-outline" onClick={exportCSV}>⬇ Export CSV</button>
                  </div>

                  <div className="stats-grid" style={{ marginBottom: 28 }}>
                    {[
                      { icon: '📬', label: 'Total Requests',   value: stats?.total_requests ?? '—',        color: '#16a34a' },
                      { icon: '🍽️', label: 'Total Listings',   value: stats?.total_listings ?? '—',        color: '#2563eb' },
                      { icon: '👥', label: 'Total Users',      value: stats?.total_users ?? '—',           color: '#7c3aed' },
                      { icon: '💰', label: 'Money Donations',  value: stats?.total_money_donations ?? '—', color: '#d97706' },
                    ].map(s => (
                      <div key={s.label} className="dashboard-card stat-card">
                        <span className="stat-card__icon">{s.icon}</span>
                        <span className="stat-card__value" style={{ color: s.color }}>{s.value}</span>
                        <span className="stat-card__label">{s.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="ad-report-grid">
                    <div className="ad-report-card">
                      <h3 className="ad-report-card__title">Requests by Status</h3>
                      {Object.entries(stats?.requests_by_status || {}).length === 0
                        ? <p className="dd-empty-sm">No data yet.</p>
                        : Object.entries(stats.requests_by_status).map(([status, count]) => {
                          const max = Math.max(...Object.values(stats.requests_by_status));
                          return (
                            <div key={status} className="ad-bar-row">
                              <span className="ad-bar-label">{status}</span>
                              <div className="ad-bar-track">
                                <div className="ad-bar-fill" style={{ width: `${max > 0 ? Math.round((count / max) * 100) : 0}%` }} />
                              </div>
                              <span className="ad-bar-value">{count}</span>
                            </div>
                          );
                        })}
                    </div>

                    <div className="ad-report-card">
                      <h3 className="ad-report-card__title">Users by Role</h3>
                      {Object.entries(stats?.users_by_role || {}).map(([role, count]) => {
                        const max = Math.max(...Object.values(stats.users_by_role));
                        const color = role === 'donor' ? '#16a34a' : '#3b82f6';
                        return (
                          <div key={role} className="ad-bar-row">
                            <span className="ad-bar-label">{role}</span>
                            <div className="ad-bar-track">
                              <div className="ad-bar-fill" style={{ width: `${max > 0 ? Math.round((count / max) * 100) : 0}%`, background: color }} />
                            </div>
                            <span className="ad-bar-value">{count}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="ad-report-card">
                      <h3 className="ad-report-card__title">Top Requested Foods</h3>
                      {(stats?.top_requested_foods || []).length === 0
                        ? <p className="dd-empty-sm">No data yet.</p>
                        : (stats.top_requested_foods).map((f, i) => {
                          const max = stats.top_requested_foods[0]?.count || 1;
                          return (
                            <div key={f.name} className="ad-bar-row">
                              <span className="ad-bar-label">{i + 1}. {f.name}</span>
                              <div className="ad-bar-track">
                                <div className="ad-bar-fill" style={{ width: `${Math.round((f.count / max) * 100)}%`, background: '#f59e0b' }} />
                              </div>
                              <span className="ad-bar-value">{f.count}</span>
                            </div>
                          );
                        })}
                    </div>

                    <div className="ad-report-card">
                      <h3 className="ad-report-card__title">Distributions by Month</h3>
                      {(stats?.donations_by_month || []).length === 0
                        ? <p className="dd-empty-sm">No data yet.</p>
                        : (stats.donations_by_month).map(d => {
                          const max = Math.max(...stats.donations_by_month.map(x => x.count));
                          return (
                            <div key={`${d.year}-${d.month}`} className="ad-bar-row">
                              <span className="ad-bar-label">{d.year}-{String(d.month).padStart(2, '0')}</span>
                              <div className="ad-bar-track">
                                <div className="ad-bar-fill" style={{ width: `${max > 0 ? Math.round((d.count / max) * 100) : 0}%`, background: '#0891b2' }} />
                              </div>
                              <span className="ad-bar-value">{d.count}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

            </>
          )}
        </main>
      </div>
      <TourKit tour={tour} />
    </div>
  );
}
