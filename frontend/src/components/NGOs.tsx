import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useDebounced } from '../hooks/useDebounced';
import { useNgoDirectory } from '../hooks/queries';
import { imgSrc } from '../utils/format';
import './NGOs.css';
import { DistrictSelect, Empty } from './ui';

/** The real directory: every NGO the admin has approved, with how many events it has coming up. */
export default function NGOs() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const q = useDebounced(search, 300);
  const { data, isPending, isError, refetch } = useNgoDirectory({ q, district });
  const ngos = data?.ngos ?? [];

  return (
    <div className="ngos-page">
      <div className="ngos-hero">
        <div className="ngos-hero__content container">
          <h1 className="ngos-hero__title">{t('ngos', 'title')}</h1>
          <p className="ngos-hero__sub">{t('ngos', 'subtitle')}</p>
          {!user && <button className="btn btn-primary" onClick={() => window.dispatchEvent(new Event('openSignup'))}>🤝 {t('ngos', 'register')}</button>}
        </div>
      </div>

      <div className="container ngos-body">
        <div className="fd-toolbar">
          <input className="form-control fd-search" type="search" placeholder={t('ngos', 'search_ph')} aria-label={t('ngos', 'search_ph')}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="se-filter"><DistrictSelect value={district} onChange={setDistrict} allLabel={t('food', 'all_districts')} /></div>
        </div>

        <h2 className="ngos-section-title">{t('ngos', 'partners')}</h2>
        {isPending ? <p className="dd-empty-sm">…</p> : isError ? (
          <Empty icon="⚠️" action={<button className="btn btn-primary btn-sm" onClick={() => refetch()}>{t('ui', 'try_again')}</button>}>{t('ui', 'load_failed')}</Empty>
        ) : ngos.length === 0 ? (
          <Empty icon="🤝">{search || district ? t('ngos', 'no_match') : t('ngos', 'none_yet')}</Empty>
        ) : (
          <div className="ngos-grid">
            {ngos.map((n) => (
              <div key={n.id} className="ngos-card card">
                <div className="ngos-card__logo-wrap ngos-card__icon">
                  {n.logo ? <img src={imgSrc(n.logo)} alt="" /> : <span aria-hidden="true">🤝</span>}
                </div>
                <div className="ngos-card__body">
                  <h3 className="ngos-card__name"><Link to={`/profile/${n.id}`}>{n.org_name}</Link></h3>
                  <span className="ngos-card__impact badge badge-green">📍 {n.district ?? '—'}</span>
                  {n.upcoming_events > 0 && (
                    <Link to="/events" className="badge badge-blue" style={{ marginLeft: 6 }}>📅 {n.upcoming_events} {t('ngos', 'upcoming')}</Link>
                  )}
                  {n.description && <p className="ngos-card__desc">{n.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="ngos-join card">
          <h2>🤝 {t('ngos', 'join_title')}</h2>
          <p>{t('ngos', 'join_text')}</p>
          <button className="btn btn-primary" onClick={() => window.dispatchEvent(new Event(user ? 'openLogin' : 'openSignup'))}>{t('ngos', 'register')}</button>
        </div>
      </div>
    </div>
  );
}
