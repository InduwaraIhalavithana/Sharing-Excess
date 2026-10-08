import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from './i18n/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { useMyRequests, usePublicListings, useRatingSummary } from './hooks/queries';
import NearbyFeed from './components/NearbyFeed';
import RequestBoard from './components/RequestBoard';
import { SkeletonGrid } from './components/SkeletonCard.jsx';
import Toast, { type ToastState } from './components/Toast';
import { TourKit, useTour, GettingStartedChecklist } from './components/tour/TourKit';
import { Stars } from './components/ui';

export default function RecipientDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'requests' ? 'requests' : 'food';
  const [toast, setToast] = useState<ToastState | null>(null);

  const tour = useTour('recipient');
  const requestsQ = useMyRequests(!!user);
  const nearQ = usePublicListings({ limit: 1 });
  const rating = useRatingSummary(user?.id);
  const requests = requestsQ.data?.requests ?? [];
  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type }), []);
  const count = (s: string) => requests.filter((r) => r.status === s).length;

  const stats = [
    { icon: '🍽️', value: nearQ.data?.total ?? 0, label: t('dash', 'food_near_you') },
    { icon: '⏳', value: count('pending'), label: t('dash', 'waiting_donor') },
    { icon: '🤝', value: count('accepted') + count('collected'), label: t('dash', 'to_collect') },
    { icon: '✅', value: count('completed'), label: t('dash', 'received') },
  ];
  const setTab = (k: string) => setParams(k === 'food' ? {} : { tab: k });

  return (
    <div className="dashboard-page">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}
      <div className="dd-header">
        <div>
          <h1 className="dd-title">{t('recipient', 'dashboard_title')}</h1>
          <p className="dd-welcome">{t('recipient', 'welcome')} <strong>{user?.name}</strong>{user?.district && <> · 📍 {user.district}</>}</p>
          <div className="dd-header__chips">
            <span className="dd-impact-chip">📦 {count('completed')} {t('dash', 'received')}</span>
            {rating.data && rating.data.count > 0 && rating.data.average !== null && <span className="dd-impact-chip"><Stars value={rating.data.average} count={rating.data.count} /></span>}
          </div>
        </div>
        <Link to="/account#notifications" className="btn btn-primary">🔔 {t('dash', 'alert_prefs')}</Link>
      </div>

      {user && !user.district && (
        <div className="se-notice se-notice--warn">⚠️ {t('food', 'set_district')} <Link to="/account">{t('nav', 'account_settings')}</Link></div>
      )}

      <GettingStartedChecklist
        storageKey="se-checklist-recipient-v2"
        items={[
          { id: 'profile', label: t('tour', 'check_profile'), href: '/account', done: !!(user?.phone_number && user?.district) },
          { id: 'request', label: t('tour', 'check_first_request'), href: '/recipient-dashboard', done: requests.length > 0 },
          { id: 'received', label: t('tour', 'check_first_received'), href: '/recipient-dashboard?tab=requests', done: count('completed') > 0 },
        ]}
      />

      <div className="stats-grid" data-tour="recipient-stats">
        {stats.map((s) => (
          <div key={s.label} className="dashboard-card stat-card">
            <span className="stat-card__icon">{s.icon}</span>
            <span className="stat-card__value">{requestsQ.isPending ? '—' : s.value}</span>
            <span className="stat-card__label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="dd-tabs" data-tour="recipient-tabs">
        <button className={`dd-tab${tab === 'food' ? ' active' : ''}`} onClick={() => setTab('food')}>🍽️ {t('dash', 'nearby_tab')}</button>
        <button className={`dd-tab${tab === 'requests' ? ' active' : ''}`} onClick={() => setTab('requests')}>📋 {t('dash', 'my_requests_tab')} ({requests.length})</button>
        <button className="dd-refresh" onClick={() => { requestsQ.refetch(); nearQ.refetch(); }} title={t('ui', 'refresh')}>↻</button>
      </div>

      {tab === 'food' ? <NearbyFeed /> : requestsQ.isPending ? <SkeletonGrid count={4} /> : (
        <RequestBoard requests={requests} notify={notify} emptyText={t('recipient', 'no_requests')} />
      )}
      <TourKit tour={tour} />
    </div>
  );
}
