import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useDebounced } from '../hooks/useDebounced';
import { useMeta, usePublicListings } from '../hooks/queries';
import { CATEGORY_ICON } from '../utils/format';
import ListingCard from './ListingCard';
import { SkeletonGrid } from './SkeletonCard.jsx';
import { Empty } from './ui';

/** The signed-in recipient's feed: their own district first, then neighbours, then the rest. */
export default function NearbyFeed() {
  const { t } = useLanguage();
  const { data: meta } = useMeta();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const q = useDebounced(search, 300);
  const { data, isPending, isError, refetch } = usePublicListings({ q, category, limit: 48 });
  const items = data?.listings ?? [];

  return (
    <div data-tour="recipient-food">
      <div className="dd-search-row" data-tour="recipient-search">
        <input className="form-control" type="search" style={{ maxWidth: 360 }} placeholder={t('food', 'search_ph')}
          aria-label={t('food', 'search_ph')} value={search} onChange={(e) => setSearch(e.target.value)} />
        {data?.near && <span className="se-chip se-chip--near">📍 {t('food', 'nearest_to')} {data.near}</span>}
        <Link to="/food" className="btn btn-outline btn-sm">🗺️ {t('food', 'browse_all')}</Link>
      </div>
      <div className="se-catbar" role="group" aria-label={t('food', 'category')}>
        <button className={`se-catchip${category === '' ? ' on' : ''}`} onClick={() => setCategory('')}>✨ {t('food', 'all')}</button>
        {(meta?.categories ?? []).map((c) => (
          <button key={c} className={`se-catchip${category === c ? ' on' : ''}`} onClick={() => setCategory(category === c ? '' : c)}>
            {CATEGORY_ICON[c]} {t('cat', c)}
          </button>
        ))}
      </div>
      {isPending ? <SkeletonGrid count={6} /> : isError ? (
        <Empty icon="⚠️" action={<button className="btn btn-primary btn-sm" onClick={() => refetch()}>{t('ui', 'try_again')}</button>}>{t('ui', 'load_failed')}</Empty>
      ) : items.length === 0 ? (
        <Empty icon="🌾">{search || category ? t('food', 'no_match') : t('food', 'none_now')}</Empty>
      ) : (
        <div className="cards-grid se-grid">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
      )}
    </div>
  );
}
