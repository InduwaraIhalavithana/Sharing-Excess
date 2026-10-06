import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from './i18n/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { useCloseListing, useDeleteListing, useMyListings, useMyRequests, useRatingSummary, useUpdateListing } from './hooks/queries';
import type { Listing } from './types/api';
import { fmtDateTime } from './utils/format';
import ListingCard from './components/ListingCard';
import RequestBoard from './components/RequestBoard';
import { SkeletonGrid } from './components/SkeletonCard.jsx';
import Toast, { type ToastState } from './components/Toast';
import { TourKit, useTour, GettingStartedChecklist } from './components/tour/TourKit';
import { Empty, Modal, ReasonModal, Stars, StatusBadge } from './components/ui';

type Tab = 'requests' | 'listings';

function EditListing({ l, onClose, notify }: { l: Listing; onClose: () => void; notify: (m: string, t?: 'success' | 'error') => void }) {
  const { t } = useLanguage();
  const update = useUpdateListing();
  const [total, setTotal] = useState(String(l.quantity_total));
  const [expires, setExpires] = useState(l.expires_at.slice(0, 16));
  const [desc, setDesc] = useState(l.description ?? '');
  const [area, setArea] = useState(l.area ?? '');
  const [address, setAddress] = useState(l.pickup_address ?? '');
  const held = l.quantity_total - l.quantity_available;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: l.id, data: {
        quantity_total: Number(total), expires_at: expires, description: desc, area, pickup_address: address,
      } });
      notify(t('dash', 'listing_saved'));
      onClose();
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  };

  return (
    <Modal title={`${t('dash', 'edit')}: ${l.food_name}`} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label" htmlFor="ed-total">{t('post', 'quantity')} ({l.unit})</label>
            <input id="ed-total" className="form-control" type="number" step="any" min={held || 0.01} value={total} onChange={(e) => setTotal(e.target.value)} />
            {held > 0 && <small className="pf-hint">{t('dash', 'held_note')} {held} {l.unit}</small>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ed-exp">{t('post', 'expires')}</label>
            <input id="ed-exp" className="form-control" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ed-desc">{t('post', 'description')}</label>
          <textarea id="ed-desc" className="form-control" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label" htmlFor="ed-area">{t('post', 'area')}</label>
            <input id="ed-area" className="form-control" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ed-addr">{t('post', 'address')}</label>
            <input id="ed-addr" className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <div className="se-modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('ui', 'cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={update.isPending}>{t('ui', 'save')}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function DonorDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'listings' ? 'listings' : 'requests';
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [closing, setClosing] = useState<Listing | null>(null);

  const tour = useTour('donor');
  const listingsQ = useMyListings(user?.id);
  const requestsQ = useMyRequests(!!user);
  const rating = useRatingSummary(user?.id);
  const closeListing = useCloseListing();
  const remove = useDeleteListing();

  const listings = listingsQ.data?.listings ?? [];
  const requests = requestsQ.data?.requests ?? [];
  const loading = listingsQ.isPending || requestsQ.isPending;
  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type }), []);

  const count = (s: string) => requests.filter((r) => r.status === s).length;
  const live = listings.filter((l) => l.status === 'active').length;
  const needAnswer = count('pending');
  const shown = statusFilter ? requests.filter((r) => r.status === statusFilter) : requests;

  const stats = [
    { icon: '🍽️', value: live, label: t('dash', 'live_listings') },
    { icon: '⏳', value: needAnswer, label: t('dash', 'awaiting_you') },
    { icon: '🤝', value: count('accepted') + count('collected'), label: t('dash', 'in_progress') },
    { icon: '✅', value: count('completed'), label: t('dash', 'handed_over') },
  ];

  const setTab = (k: Tab) => setParams(k === 'requests' ? {} : { tab: k });

  const doDelete = async (l: Listing) => {
    if (!window.confirm(`${t('dash', 'delete_confirm')} "${l.food_name}"?`)) return;
    try { await remove.mutateAsync(l.id); notify(t('dash', 'deleted')); } catch (err) { notify((err as Error).message, 'error'); }
  };

  return (
    <div className="dashboard-page">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}

      <div className="dd-header">
        <div>
          <h1 className="dd-title">{t('donor', 'dashboard_title')}</h1>
          <p className="dd-welcome">{t('donor', 'welcome')} <strong>{user?.name}</strong>{user?.district && <> · 📍 {user.district}</>}</p>
          <div className="dd-header__chips">
            <span className="dd-impact-chip">📦 {count('completed')} {t('dash', 'handed_over')}</span>
            {rating.data && rating.data.count > 0 && rating.data.average !== null && (
              <span className="dd-impact-chip"><Stars value={rating.data.average} count={rating.data.count} /></span>
            )}
            {needAnswer > 0 && <span className="dd-impact-chip">⚡ {needAnswer} {t('dash', 'awaiting_you')}</span>}
          </div>
        </div>
        <Link to="/post-food" className="btn btn-primary" data-tour="donor-add">+ {t('donor', 'add_listing')}</Link>
      </div>

      <GettingStartedChecklist
        storageKey="se-checklist-donor-v2"
        items={[
          { id: 'profile', label: t('tour', 'check_profile'), href: '/account', done: !!(user?.phone_number && user?.district) },
          { id: 'listing', label: t('tour', 'check_first_listing'), href: '/post-food', done: listings.length > 0 },
          { id: 'respond', label: t('tour', 'check_first_response'), href: '/donor-dashboard', done: requests.some((r) => r.status !== 'pending') },
          { id: 'done', label: t('tour', 'check_first_delivery'), href: '/donor-dashboard', done: count('completed') > 0 },
        ]}
      />

      <div className="stats-grid" data-tour="donor-stats">
        {stats.map((s) => (
          <div key={s.label} className="dashboard-card stat-card">
            <span className="stat-card__icon">{s.icon}</span>
            <span className="stat-card__value">{loading ? '—' : s.value}</span>
            <span className="stat-card__label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="dd-tabs" data-tour="donor-tabs">
        <button className={`dd-tab${tab === 'requests' ? ' active' : ''}`} onClick={() => setTab('requests')}>📬 {t('dash', 'requests_tab')} ({requests.length})</button>
        <button className={`dd-tab${tab === 'listings' ? ' active' : ''}`} onClick={() => setTab('listings')}>🍽️ {t('dash', 'listings_tab')} ({listings.length})</button>
        <button className="dd-refresh" onClick={() => { listingsQ.refetch(); requestsQ.refetch(); }} title={t('ui', 'refresh')}>↻</button>
      </div>

      {loading ? <SkeletonGrid count={6} /> : tab === 'requests' ? (
        <div data-tour="donor-requests">
          <div className="dd-search-row">
            <select className="form-control" style={{ maxWidth: 220 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t('dash', 'filter_status')}>
              <option value="">{t('dash', 'all_statuses')}</option>
              {['pending', 'accepted', 'collected', 'completed', 'declined', 'cancelled', 'no_show', 'expired'].map((s) => <option key={s} value={s}>{t('status', s)}</option>)}
            </select>
          </div>
          <RequestBoard requests={shown} notify={notify} emptyText={t('donor', 'no_requests')} />
        </div>
      ) : listings.length === 0 ? (
        <Empty icon="🍽️" action={<Link to="/post-food" className="btn btn-primary btn-sm">{t('donor', 'add_listing')}</Link>}>{t('donor', 'no_listings')}</Empty>
      ) : (
        <div className="cards-grid se-grid">
          {listings.map((l) => {
            const open = requests.filter((r) => r.listing.id === l.id && r.status === 'pending').length;
            return (
              <ListingCard
                key={l.id} l={{ ...l, proximity: null }}
                footer={(
                  <>
                    <div className="se-listing__chips">
                      <StatusBadge status={l.status} />
                      {open > 0 && <span className="se-chip se-chip--hot">⏳ {open} {t('dash', 'waiting')}</span>}
                      <span className="se-chip se-chip--gray">🕒 {fmtDateTime(l.expires_at)}</span>
                    </div>
                    <div className="dd-card-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setEditing(l)} disabled={l.status === 'closed'}>✏️ {t('dash', 'edit')}</button>
                      {l.status !== 'closed' && <button className="btn btn-outline btn-sm btn-outline--danger" onClick={() => setClosing(l)}>⏹ {t('dash', 'close')}</button>}
                      <button className="btn btn-outline btn-sm btn-outline--danger" onClick={() => doDelete(l)}>🗑</button>
                    </div>
                  </>
                )}
              />
            );
          })}
        </div>
      )}

      {editing && <EditListing l={editing} onClose={() => setEditing(null)} notify={notify} />}
      {closing && (
        <ReasonModal
          title={`${t('dash', 'close')}: ${closing.food_name}`} label={t('dash', 'close_label')} confirmLabel={t('dash', 'close')} required={false} danger
          busy={closeListing.isPending} onClose={() => setClosing(null)}
          onConfirm={async (reason) => {
            try { await closeListing.mutateAsync({ id: closing.id, reason }); notify(t('dash', 'closed_ok')); setClosing(null); }
            catch (err) { notify((err as Error).message, 'error'); }
          }}
        />
      )}
      <TourKit tour={tour} />
    </div>
  );
}
