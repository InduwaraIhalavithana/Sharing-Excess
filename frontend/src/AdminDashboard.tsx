import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';
import { useAuth } from './contexts/AuthContext';
import { useLanguage } from './i18n/LanguageContext';
import {
  useAdminAction, useAdminData, useEventAction, useEvents,
  type AdminFeedback, type AdminListing, type AdminReport, type AdminStats, type AdminUser,
} from './hooks/queries';
import { fmtDateTime } from './utils/format';
import Toast, { type ToastState } from './components/Toast';
import { TourKit, useTour } from './components/tour/TourKit';
import { Modal, ReasonModal, StatusBadge } from './components/ui';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler);
// readable on both the light and the dark panel
ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.borderColor = 'rgba(148,163,184,0.2)';
ChartJS.defaults.font.size = 14;
ChartJS.defaults.font.family = "'Inter', sans-serif";

type Section = 'overview' | 'ngos' | 'listings' | 'events' | 'reports' | 'users' | 'feedback';

const PALETTE = ['#16a34a', '#2563eb', '#f59e0b', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#64748b'];

type Ask =
  | { kind: 'reject-ngo'; user: AdminUser }
  | { kind: 'close-listing'; item: AdminListing }
  | { kind: 'reply'; item: AdminFeedback }
  | { kind: 'delete-user'; user: AdminUser }
  | { kind: 'note'; item: AdminReport; status: 'actioned' | 'dismissed' };

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const tour = useTour('admin');
  const [section, setSection] = useState<Section>('overview');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [userQ, setUserQ] = useState('');
  const [userRole, setUserRole] = useState('');
  const [reportFilter, setReportFilter] = useState('open');
  const [fbFilter, setFbFilter] = useState('open');

  const act = useAdminAction();
  const eventAct = useEventAction();
  const stats = useAdminData<AdminStats & { success: boolean }>('stats', 'stats');
  const ngos = useAdminData<{ ngos: AdminUser[] }>('ngos', 'ngos');
  const listings = useAdminData<{ listings: AdminListing[] }>('listings', 'listings');
  const users = useAdminData<{ users: AdminUser[] }>('users', 'users');
  const reports = useAdminData<{ reports: AdminReport[] }>('reports', 'reports');
  const feedback = useAdminData<{ feedback: AdminFeedback[] }>('feedback', 'feedback');
  const events = useEvents();

  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type }), []);

  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  const run = async (path: string, method: string, body: unknown, ok: string) => {
    try { await act.mutateAsync({ path, method, body }); notify(ok); setAsk(null); }
    catch (err) { notify((err as Error).message, 'error'); }
  };

  const s = stats.data;
  const pendingNgos = (ngos.data?.ngos ?? []).filter((n) => n.ngo_status === 'pending');
  const openReports = (reports.data?.reports ?? []).filter((r) => r.status === 'open').length;
  const openFeedback = (feedback.data?.feedback ?? []).filter((f) => f.feedback_status === 'open').length;

  const NAV: { key: Section; icon: string; badge?: number }[] = [
    { key: 'overview', icon: '📊' },
    { key: 'ngos', icon: '🤝', badge: pendingNgos.length },
    { key: 'listings', icon: '🍽️' },
    { key: 'events', icon: '📅' },
    { key: 'reports', icon: '🚩', badge: openReports },
    { key: 'users', icon: '👥' },
    { key: 'feedback', icon: '💬', badge: openFeedback },
  ];

  const initials = (user.name || 'AD').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const refetchAll = () => { [stats, ngos, listings, users, reports, feedback, events].forEach((q) => q.refetch()); };
  const doLogout = () => { logout(); navigate('/'); };

  const shownUsers = (users.data?.users ?? []).filter((u) => {
    const q = userQ.toLowerCase();
    return (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.org_name ?? '').toLowerCase().includes(q))
      && (!userRole || u.role === userRole);
  });
  const shownReports = (reports.data?.reports ?? []).filter((r) => reportFilter === 'all' || r.status === reportFilter);
  const shownFeedback = (feedback.data?.feedback ?? []).filter((f) => fbFilter === 'all' || f.feedback_status === fbFilter);

  const targetLink = (r: AdminReport) => {
    if (r.target_type === 'listing') return <Link to={`/listings/${r.target_id}`} target="_blank">#{r.target_id}</Link>;
    if (r.target_type === 'event') return <Link to="/events" target="_blank">#{r.target_id}</Link>;
    return <>#{r.target_id}</>;
  };

  return (
    <div className="adm-shell">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}

      <aside className="adm-sidebar">
        <div className="adm-sidebar__brand">
          <div className="adm-sidebar__brand-icon">🌿</div>
          <div>
            <div className="adm-sidebar__brand-name">Sharing Excess</div>
            <div className="adm-sidebar__brand-sub">{t('admin', 'panel')}</div>
          </div>
        </div>
        <nav className="adm-sidebar__nav" data-tour="admin-nav">
          {NAV.map(({ key, icon, badge }) => (
            <button key={key} className={`adm-sidebar__link${section === key ? ' active' : ''}`} onClick={() => setSection(key)}
              data-tour={key === 'ngos' ? 'admin-verify' : undefined}>
              <span className="adm-sidebar__link-icon">{icon}</span>
              <span>{t('admin', `nav_${key}`)}</span>
              {!!badge && <span className="adm-sidebar__badge">{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="adm-sidebar__user">
          <div className="adm-sidebar__user-avatar">{initials}</div>
          <div className="adm-sidebar__user-info">
            <div className="adm-sidebar__user-name">{user.name}</div>
            <div className="adm-sidebar__user-role">{t('admin', 'role')}</div>
          </div>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <h1 className="adm-topbar__title" style={{ margin: 0 }}>{t('admin', `nav_${section}`)}</h1>
          <div className="adm-topbar__right">
            <Link to="/" className="adm-refresh-btn">🌐 {t('admin', 'view_site')}</Link>
            <button className="adm-refresh-btn" data-tour="admin-refresh" onClick={refetchAll}>↻ {t('ui', 'refresh')}</button>
            <button className="adm-logout-btn" onClick={doLogout}>🚪 {t('nav', 'logout')}</button>
          </div>
        </header>

        <main className="adm-content">
          {section === 'overview' && (
            <>
              <div className="stats-grid" data-tour="admin-stats" style={{ marginBottom: 24 }}>
                {[
                  ['👥', s?.total_users, t('admin', 'st_users')],
                  ['🍽️', s?.total_listings, t('admin', 'st_listings')],
                  ['📬', s?.total_requests, t('admin', 'st_requests')],
                  ['✅', s?.handovers_completed, t('admin', 'st_completed')],
                  ['🤝', s?.pending_ngos, t('admin', 'st_pending_ngos')],
                  ['🚩', s?.open_reports, t('admin', 'st_reports')],
                  ['💬', s?.open_feedback, t('admin', 'st_feedback')],
                  ['📅', s?.upcoming_events, t('admin', 'st_events')],
                ].map(([icon, value, label]) => (
                  <div key={String(label)} className="dashboard-card stat-card">
                    <span className="stat-card__icon">{icon}</span>
                    <span className="stat-card__value">{value ?? '—'}</span>
                    <span className="stat-card__label">{label}</span>
                  </div>
                ))}
              </div>
              {s && (
                <div className="od-charts">
                  <div className="od-chart-card">
                    <h3 className="od-chart-title">{t('admin', 'ch_listings')}</h3>
                    <div className="od-chart-box"><Doughnut data={{ labels: Object.keys(s.listings_by_status).map((k) => t('status', k)), datasets: [{ data: Object.values(s.listings_by_status), backgroundColor: PALETTE }] }} options={{ maintainAspectRatio: false }} /></div>
                  </div>
                  <div className="od-chart-card">
                    <h3 className="od-chart-title">{t('admin', 'ch_requests')}</h3>
                    <div className="od-chart-box"><Doughnut data={{ labels: Object.keys(s.requests_by_status).map((k) => t('status', k)), datasets: [{ data: Object.values(s.requests_by_status), backgroundColor: PALETTE }] }} options={{ maintainAspectRatio: false }} /></div>
                  </div>
                  <div className="od-chart-card od-chart-card--wide">
                    <h3 className="od-chart-title">{t('admin', 'ch_districts')}</h3>
                    <div className="od-chart-box"><Bar data={{ labels: Object.keys(s.listings_by_district), datasets: [{ label: t('admin', 'st_listings'), data: Object.values(s.listings_by_district), backgroundColor: '#16a34a' }] }} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} /></div>
                  </div>
                  <div className="od-chart-card od-chart-card--wide">
                    <h3 className="od-chart-title">{t('admin', 'ch_month')}</h3>
                    <div className="od-chart-box">
                      {s.completed_by_month.length === 0 ? <p className="dd-empty-sm">{t('admin', 'no_data')}</p> : (
                        <Line data={{ labels: s.completed_by_month.map((m) => `${m.year}-${String(m.month).padStart(2, '0')}`), datasets: [{ label: t('admin', 'st_completed'), data: s.completed_by_month.map((m) => m.count), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.15)', fill: true, tension: 0.3 }] }} options={{ maintainAspectRatio: false }} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {section === 'ngos' && (
            <div className="od-table-wrap">
              <table className="od-table">
                <thead><tr><th>{t('ngo', 'org_name')}</th><th>{t('admin', 'contact')}</th><th>{t('post', 'district')}</th><th>{t('ui', 'status')}</th><th /></tr></thead>
                <tbody>
                  {(ngos.data?.ngos ?? []).map((n) => (
                    <tr key={n.id}>
                      <td><strong>{n.org_name || n.name}</strong><br /><small>{n.org_description}</small></td>
                      <td>{n.name}<br /><small>{n.email}{n.phone_number ? ` · ${n.phone_number}` : ''}</small></td>
                      <td>{n.district}</td>
                      <td><StatusBadge status={n.ngo_status ?? 'pending'} /></td>
                      <td>
                        <div className="adm-row-actions">
                          {n.ngo_status !== 'approved' && <button className="btn btn-primary btn-sm" onClick={() => run(`ngos/${n.id}/approve`, 'POST', undefined, t('admin', 'approved_ok'))}>✓ {t('admin', 'approve')}</button>}
                          {n.ngo_status !== 'rejected' && <button className="btn btn-sm adm-btn-danger" onClick={() => setAsk({ kind: 'reject-ngo', user: n })}>✕ {t('admin', 'reject')}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!ngos.isPending && (ngos.data?.ngos ?? []).length === 0 && <p className="dd-empty-sm">{t('admin', 'no_ngos')}</p>}
            </div>
          )}

          {section === 'listings' && (
            <div className="od-table-wrap">
              <table className="od-table">
                <thead><tr><th>{t('admin', 'food')}</th><th>{t('admin', 'donor')}</th><th>{t('post', 'district')}</th><th>{t('admin', 'stock')}</th><th>{t('admin', 'expires')}</th><th>{t('ui', 'status')}</th><th /></tr></thead>
                <tbody>
                  {(listings.data?.listings ?? []).map((l) => (
                    <tr key={l.id}>
                      <td><Link to={`/listings/${l.id}`} target="_blank"><strong>{l.food_name}</strong></Link></td>
                      <td>{l.donor_name}</td><td>{l.district}</td>
                      <td>{l.quantity_available} / {l.quantity_total} {l.unit}</td>
                      <td>{fmtDateTime(l.expires_at)}</td>
                      <td><StatusBadge status={l.status} /></td>
                      <td>
                        <div className="adm-row-actions">
                          {l.status !== 'closed' && <button className="btn btn-sm btn-outline" onClick={() => setAsk({ kind: 'close-listing', item: l })}>⏹ {t('dash', 'close')}</button>}
                          <button className="btn btn-sm adm-btn-danger" onClick={() => { if (window.confirm(`${t('dash', 'delete_confirm')} "${l.food_name}"?`)) run(`listings/${l.id}`, 'DELETE', undefined, t('dash', 'deleted')); }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!listings.isPending && (listings.data?.listings ?? []).length === 0 && <p className="dd-empty-sm">{t('admin', 'no_listings')}</p>}
            </div>
          )}

          {section === 'events' && (
            <div className="od-table-wrap">
              <table className="od-table">
                <thead><tr><th>{t('ngo', 'ev_title')}</th><th>{t('admin', 'organiser')}</th><th>{t('ngo', 'when')}</th><th>{t('post', 'district')}</th><th>{t('ui', 'status')}</th><th /></tr></thead>
                <tbody>
                  {(events.data?.events ?? []).map((e) => (
                    <tr key={e.id}>
                      <td><strong>{e.title}</strong></td><td>{e.organiser?.name ?? '—'}</td><td>{fmtDateTime(e.starts_at)}</td><td>{e.district}</td>
                      <td>{e.status === 'cancelled' ? <span className="badge badge-red">{t('ngo', 'cancelled')}</span> : <StatusBadge status="published" />}</td>
                      <td>
                        <div className="adm-row-actions">
                          {e.status === 'published' && <button className="btn btn-sm btn-outline" onClick={() => eventAct.mutate({ id: e.id, action: 'cancel' }, { onSuccess: () => notify(t('ngo', 'cancelled_ok')), onError: (er) => notify(er.message, 'error') })}>{t('ngo', 'cancel_event')}</button>}
                          <button className="btn btn-sm adm-btn-danger" onClick={() => { if (window.confirm(`${t('ngo', 'delete_confirm')} "${e.title}"?`)) eventAct.mutate({ id: e.id, action: 'delete' }, { onSuccess: () => notify(t('ngo', 'deleted_ok')), onError: (er) => notify(er.message, 'error') }); }}>{t('ngo', 'delete')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!events.isPending && (events.data?.events ?? []).length === 0 && <p className="dd-empty-sm">{t('events', 'no_events')}</p>}
            </div>
          )}

          {section === 'reports' && (
            <>
              <div className="dd-search-row">
                <select className="form-control" style={{ maxWidth: 200 }} value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} aria-label={t('ui', 'status')}>
                  {['open', 'actioned', 'dismissed', 'all'].map((k) => <option key={k} value={k}>{k === 'all' ? t('dash', 'all_statuses') : t('status', k)}</option>)}
                </select>
              </div>
              <div className="od-table-wrap">
                <table className="od-table">
                  <thead><tr><th>{t('admin', 'about')}</th><th>{t('admin', 'reason')}</th><th>{t('admin', 'by')}</th><th>{t('ui', 'status')}</th><th /></tr></thead>
                  <tbody>
                    {shownReports.map((r) => (
                      <tr key={r.id}>
                        <td>{r.target_type} {targetLink(r)}</td>
                        <td>{r.reason}{r.admin_note && <><br /><small>📝 {r.admin_note}</small></>}</td>
                        <td>{r.reporter_name ?? t('admin', 'guest')}<br /><small>{r.created_at ? fmtDateTime(r.created_at) : ''}</small></td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>
                          {r.status === 'open' && (
                            <div className="adm-row-actions">
                              <button className="btn btn-primary btn-sm" onClick={() => setAsk({ kind: 'note', item: r, status: 'actioned' })}>✓ {t('admin', 'actioned')}</button>
                              <button className="btn btn-sm btn-outline" onClick={() => setAsk({ kind: 'note', item: r, status: 'dismissed' })}>{t('admin', 'dismiss')}</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!reports.isPending && shownReports.length === 0 && <p className="dd-empty-sm">{t('admin', 'no_reports')}</p>}
              </div>
            </>
          )}

          {section === 'users' && (
            <>
              <div className="dd-search-row">
                <input className="form-control" style={{ maxWidth: 280 }} type="search" placeholder={t('admin', 'search_users')} value={userQ} onChange={(e) => setUserQ(e.target.value)} aria-label={t('admin', 'search_users')} />
                <select className="form-control" style={{ maxWidth: 180 }} value={userRole} onChange={(e) => setUserRole(e.target.value)} aria-label={t('auth', 'role')}>
                  <option value="">{t('admin', 'all_roles')}</option>
                  {['donor', 'recipient', 'ngo'].map((r) => <option key={r} value={r}>{t('role', r)}</option>)}
                </select>
              </div>
              <div className="od-table-wrap">
                <table className="od-table">
                  <thead><tr><th>{t('auth', 'name')}</th><th>{t('auth', 'role')}</th><th>{t('post', 'district')}</th><th>{t('ui', 'status')}</th><th>{t('admin', 'joined')}</th><th /></tr></thead>
                  <tbody>
                    {shownUsers.map((u) => (
                      <tr key={u.id}>
                        <td><strong>{u.org_name || u.name}</strong><br /><small>{u.email}</small></td>
                        <td>{t('role', u.role)}</td><td>{u.district ?? '—'}</td>
                        <td><StatusBadge status={u.status === 'pending' ? 'pending' : u.status} /></td>
                        <td>{u.created_at ? fmtDateTime(u.created_at) : '—'}</td>
                        <td>
                          <div className="adm-row-actions">
                            <button className="btn btn-sm btn-outline" onClick={() => run(`users/${u.id}/suspend`, 'PATCH', undefined, t('admin', 'updated'))}>{u.status === 'suspended' ? t('admin', 'reinstate') : t('admin', 'suspend')}</button>
                            <button className="btn btn-sm adm-btn-danger" onClick={() => setAsk({ kind: 'delete-user', user: u })}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!users.isPending && shownUsers.length === 0 && <p className="dd-empty-sm">{t('admin', 'no_users')}</p>}
              </div>
            </>
          )}

          {section === 'feedback' && (
            <>
              <div className="dd-search-row">
                <select className="form-control" style={{ maxWidth: 200 }} value={fbFilter} onChange={(e) => setFbFilter(e.target.value)} aria-label={t('ui', 'status')}>
                  {['open', 'resolved', 'all'].map((k) => <option key={k} value={k}>{k === 'all' ? t('dash', 'all_statuses') : t('status', k)}</option>)}
                </select>
              </div>
              <div className="adm-fb-list">
                {shownFeedback.map((f) => (
                  <div key={f.id} className="adm-fb-card">
                    <div className="adm-fb-card__header">
                      <div className="adm-fb-card__user">
                        <div className="adm-fb-card__avatar">💬</div>
                        <div>
                          <div className="adm-fb-card__name">{f.author_name} <small>({f.author_role ? t('role', f.author_role) : '—'})</small></div>
                          <div className="adm-fb-card__meta">{f.created_at ? fmtDateTime(f.created_at) : ''}{f.rating ? ` · ${'★'.repeat(f.rating)}` : ''}</div>
                        </div>
                      </div>
                      <StatusBadge status={f.feedback_status} />
                    </div>
                    <p>{f.comment}</p>
                    {f.admin_reply && <p className="adm-fb-reply">↩ {f.admin_reply}</p>}
                    <div className="adm-row-actions">
                      {f.feedback_status === 'open'
                        ? <button className="btn btn-primary btn-sm" onClick={() => setAsk({ kind: 'reply', item: f })}>✓ {t('admin', 'resolve')}</button>
                        : <button className="btn btn-sm btn-outline" onClick={() => run(`feedback/${f.id}/reopen`, 'PATCH', undefined, t('admin', 'updated'))}>{t('admin', 'reopen')}</button>}
                      <button className="btn btn-sm adm-btn-danger" onClick={() => run(`feedback/${f.id}`, 'DELETE', undefined, t('dash', 'deleted'))}>🗑</button>
                    </div>
                  </div>
                ))}
                {!feedback.isPending && shownFeedback.length === 0 && <p className="dd-empty-sm">{t('admin', 'no_feedback')}</p>}
              </div>
            </>
          )}
        </main>
      </div>

      {ask?.kind === 'reject-ngo' && (
        <ReasonModal title={`${t('admin', 'reject')}: ${ask.user.org_name || ask.user.name}`} label={t('admin', 'reject_label')} confirmLabel={t('admin', 'reject')} required danger
          busy={act.isPending} onClose={() => setAsk(null)} onConfirm={(reason) => run(`ngos/${ask.user.id}/reject`, 'POST', { reason }, t('admin', 'rejected_ok'))} />
      )}
      {ask?.kind === 'close-listing' && (
        <ReasonModal title={`${t('dash', 'close')}: ${ask.item.food_name}`} label={t('admin', 'close_label')} confirmLabel={t('dash', 'close')} required={false} danger
          busy={act.isPending} onClose={() => setAsk(null)} onConfirm={(reason) => run(`listings/${ask.item.id}/close`, 'POST', { reason }, t('dash', 'closed_ok'))} />
      )}
      {ask?.kind === 'note' && (
        <ReasonModal title={ask.status === 'actioned' ? t('admin', 'actioned') : t('admin', 'dismiss')} label={t('admin', 'note_label')} confirmLabel={t('ui', 'save')} required={false}
          busy={act.isPending} onClose={() => setAsk(null)} onConfirm={(note) => run(`reports/${ask.item.id}`, 'PATCH', { status: ask.status, admin_note: note }, t('admin', 'updated'))} />
      )}
      {ask?.kind === 'reply' && (
        <ReasonModal title={t('admin', 'resolve')} label={`${t('admin', 'reply_label')}: “${ask.item.comment.slice(0, 80)}”`} confirmLabel={t('admin', 'resolve')} required={false}
          busy={act.isPending} onClose={() => setAsk(null)} onConfirm={(reply) => run(`feedback/${ask.item.id}/resolve`, 'POST', { reply }, t('admin', 'updated'))} />
      )}
      {ask?.kind === 'delete-user' && (
        <Modal title={`${t('admin', 'delete_user')}: ${ask.user.org_name || ask.user.name}`} onClose={() => setAsk(null)}>
          <p>{t('admin', 'delete_user_warn')}</p>
          <div className="se-modal-actions">
            <button className="btn btn-outline" onClick={() => setAsk(null)}>{t('ui', 'cancel')}</button>
            <button className="btn btn-danger" disabled={act.isPending} onClick={() => run(`users/${ask.user.id}`, 'DELETE', undefined, t('dash', 'deleted'))}>{t('admin', 'delete_user')}</button>
          </div>
        </Modal>
      )}
      <TourKit tour={tour} />
    </div>
  );
}
