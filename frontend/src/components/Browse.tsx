import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useDebounced } from '../hooks/useDebounced';
import { useMeta, usePublicListings } from '../hooks/queries';
import { CATEGORY_ICON } from '../utils/format';
import ListingCard from './ListingCard';
import { SkeletonGrid } from './SkeletonCard.jsx';
import { DistrictSelect, Empty } from './ui';

// The map (and Leaflet) only downloads when someone opens the map view
const FoodMap = lazy(() => import('./FoodMap'));

/** Public browse page: nearest district first, then neighbours, then the rest. Guests can look; requesting needs login. */
export default function Browse() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: meta } = useMeta();

  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [near, setNear] = useState('');
  const [category, setCategory] = useState('');
  const [fulfilment, setFulfilment] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [limit, setLimit] = useState(24);
  const q = useDebounced(search, 300);

  const { data, isPending, isError, isFetching, refetch } = usePublicListings({ q, district, near, category, fulfilment, limit });
  const items = data?.listings ?? [];
  const total = data?.total ?? 0;
  const home = data?.near ?? null;
  const filtered = !!(search || district || category || fulfilment);

  const clear = () => { setSearch(''); setDistrict(''); setCategory(''); setFulfilment(''); };

  return (
    <div className="fd-page">
      <div className="fd-hero">
        <h1 className="fd-hero__title">🍽️ {t('food', 'browse_title')}</h1>
        <p className="fd-hero__sub">{t('food', 'browse_sub')}</p>
        <div className="fd-hero__stats">
          <span className="fd-hero__chip"><span className="fd-hero__pulse" aria-hidden="true" /> {total} {t('food', 'available_now')}</span>
          {home && <span className="fd-hero__chip">📍 {t('food', 'nearest_to')} <b>{home}</b></span>}
        </div>
      </div>

      <div className="fd-body">
        {!user && (
          <div className="se-notice">
            <span>📍 {t('food', 'near_me')}</span>
            <DistrictSelect value={near} onChange={setNear} allLabel={t('food', 'any_district')} />
            <button className="btn btn-outline btn-sm" onClick={() => window.dispatchEvent(new Event('openSignup'))}>{t('nav', 'signup')}</button>
          </div>
        )}
        {user && user.role !== 'admin' && !user.district && (
          <div className="se-notice se-notice--warn">
            ⚠️ {t('food', 'set_district')} <Link to="/account">{t('nav', 'account_settings')}</Link>
          </div>
        )}

        <div className="fd-toolbar">
          <input className="form-control fd-search" type="search" placeholder={t('food', 'search_ph')} aria-label={t('food', 'search_ph')}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="se-filter">
            <DistrictSelect value={district} onChange={setDistrict} allLabel={t('food', 'all_districts')} id="filter-district" />
          </div>
          <select className="form-control se-filter" value={fulfilment} onChange={(e) => setFulfilment(e.target.value)} aria-label={t('food', 'fulfilment')}>
            <option value="">{t('food', 'any_fulfilment')}</option>
            <option value="pickup">{t('food', 'pickup')}</option>
            <option value="delivery">{t('food', 'delivery')}</option>
          </select>
          <div className="fd-view-toggle" role="group" aria-label={t('food', 'view')}>
            <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>▦ {t('food', 'list')}</button>
            <button type="button" className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>🗺️ {t('food', 'map')}</button>
          </div>
          <button className="btn btn-outline btn-sm fd-refresh" onClick={() => refetch()}>↻ {t('ui', 'refresh')}</button>
        </div>

        <div className="se-catbar" role="group" aria-label={t('food', 'category')}>
          <button className={`se-catchip${category === '' ? ' on' : ''}`} onClick={() => setCategory('')}>✨ {t('food', 'all')}</button>
          {(meta?.categories ?? []).map((c) => (
            <button key={c} className={`se-catchip${category === c ? ' on' : ''}`} onClick={() => setCategory(category === c ? '' : c)}>
              {CATEGORY_ICON[c]} {t('cat', c)}
            </button>
          ))}
          {filtered && <button className="se-catchip se-catchip--clear" onClick={clear}>✕ {t('ui', 'clear')}</button>}
        </div>

        {isPending ? (
          <SkeletonGrid count={6} />
        ) : isError ? (
          <Empty icon="⚠️" action={<button className="btn btn-primary btn-sm" onClick={() => refetch()}>{t('ui', 'try_again')}</button>}>
            {t('ui', 'load_failed')}
          </Empty>
        ) : items.length === 0 ? (
          <Empty icon="🌾" action={!filtered && <Link to="/post-food" className="btn btn-primary btn-sm">🍱 {t('food', 'be_first')}</Link>}>
            {filtered ? t('food', 'no_match') : t('food', 'none_now')}
          </Empty>
        ) : view === 'map' ? (
          <Suspense fallback={<SkeletonGrid count={1} />}><FoodMap listings={items} /></Suspense>
        ) : (
          <>
            <div className="cards-grid se-grid" aria-busy={isFetching}>
              {items.map((l) => <ListingCard key={l.id} l={l} />)}
            </div>
            {items.length < total && (
              <div className="se-more-row">
                <button className="btn btn-outline" onClick={() => setLimit((n) => n + 24)}>{t('food', 'load_more')} ({total - items.length})</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
