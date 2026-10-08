import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import type { Listing } from '../types/api';
import { CATEGORY_ICON, imgSrc, qty, timeLeft } from '../utils/format';
import { Avatar, Stars } from './ui';

export function Stock({ l }: { l: Pick<Listing, 'quantity_available' | 'quantity_total' | 'unit'> }) {
  const pct = l.quantity_total > 0 ? Math.max(0, Math.min(100, (l.quantity_available / l.quantity_total) * 100)) : 0;
  return (
    <div className="se-stock" title={`${qty(l.quantity_available)} / ${qty(l.quantity_total)} ${l.unit}`}>
      <div className="se-stock__bar"><span style={{ width: `${pct}%` }} /></div>
      <span className="se-stock__text"><b>{qty(l.quantity_available)}</b> / {qty(l.quantity_total)} {l.unit}</span>
    </div>
  );
}

export function ExpiryChip({ expiresAt }: { expiresAt: string }) {
  const { t } = useLanguage();
  const left = timeLeft(expiresAt);
  if (left.over) return <span className="se-chip se-chip--gray">{t('food', 'expired')}</span>;
  return <span className={`se-chip ${left.urgent ? 'se-chip--hot' : 'se-chip--time'}`}>⏱ {left.text} {t('food', 'left')}</span>;
}

export function ProximityChip({ proximity }: { proximity: Listing['proximity'] }) {
  const { t } = useLanguage();
  if (!proximity) return null;
  const cls = proximity === 'same_district' ? 'se-chip--near' : proximity === 'neighbouring' ? 'se-chip--mid' : 'se-chip--far';
  return <span className={`se-chip ${cls}`}>{proximity === 'same_district' ? '📍' : proximity === 'neighbouring' ? '↔️' : '🗺️'} {t('prox', proximity)}</span>;
}

/** One listing in the browse grid, the home page strip and the donor's own list. */
export default function ListingCard({ l, footer }: { l: Listing; footer?: React.ReactNode }) {
  const { t } = useLanguage();
  const img = l.images[0];
  return (
    <article className="dashboard-card se-listing" data-testid={`listing-${l.id}`}>
      <Link to={`/listings/${l.id}`} className="se-listing__media" data-cat={l.category} aria-label={l.food_name}>
        {img
          ? <img src={imgSrc(img)} alt={l.food_name} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          : null}
        <span className="se-listing__emoji" aria-hidden="true">{CATEGORY_ICON[l.category] ?? CATEGORY_ICON.other}</span>
        <ProximityChip proximity={l.proximity} />
      </Link>
      <div className="se-listing__body">
        <h3 className="se-listing__title"><Link to={`/listings/${l.id}`}>{l.food_name}</Link></h3>
        <p className="se-listing__where">📍 {l.district}{l.area ? ` · ${l.area}` : ''}</p>
        <Stock l={l} />
        <div className="se-listing__chips">
          <ExpiryChip expiresAt={l.expires_at} />
          <span className="se-chip se-chip--gray">{CATEGORY_ICON[l.category]} {t('cat', l.category)}</span>
          {l.fulfilment !== 'pickup' && <span className="se-chip se-chip--gray">🚚 {t('food', l.fulfilment === 'both' ? 'delivery_or_pickup' : 'delivery')}</span>}
        </div>
        <p className="se-listing__donor">
          <Avatar size={22} src={l.donor_photo} name={l.donor_name} /> {l.donor_name ?? t('food', 'anonymous')}
          {l.donor_rating && <> · <Stars value={l.donor_rating.average} count={l.donor_rating.count} /></>}
        </p>
        {footer ?? <Link className="btn btn-primary btn-sm btn-block" to={`/listings/${l.id}`}>{t('food', 'view_request')}</Link>}
      </div>
    </article>
  );
}
