import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { APP_ROOT } from '../config';
import { useDebounced } from '../hooks/useDebounced';
import { usePublicListings } from '../hooks/queries';
import { SkeletonGrid } from './SkeletonCard.jsx';

export default function FoodDonationsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const { data, isPending: loading, isError, refetch } = usePublicListings({ q: debouncedSearch, limit: 50 });
  const donations = data?.listings ?? [];
  const total = data?.total ?? donations.length;
  const error = isError ? 'Network error. Please try again.' : '';
  const fetchDonations = () => refetch();

  const handleRequest = () => {
    if (!user) { window.dispatchEvent(new Event('openLogin')); return; }
    const role = String(user.role || '').toLowerCase();
    if (role === 'recipient') navigate('/recipient-dashboard');
    else navigate('/donate');
  };

  return (
    <div className="fd-page">
      {/* Hero */}
      <div className="fd-hero">
        <h1 className="fd-hero__title">🍽️ Available Food Donations</h1>
        <p className="fd-hero__sub">
          Browse surplus food shared by our generous donors — every listing verified by a field officer.
        </p>
        <div className="fd-hero__stats">
          <span className="fd-hero__chip">
            <span className="fd-hero__pulse" aria-hidden="true" /> {total} listing{total !== 1 ? 's' : ''} available now
          </span>
        </div>
      </div>

      <div className="fd-body">
        {/* Toolbar */}
        <div className="fd-toolbar">
          <input
            className="form-control fd-search"
            type="text"
            placeholder="Search food, location…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn btn-outline btn-sm" onClick={() => setSearch('')}>
              ✕ Clear
            </button>
          )}
          <button className="btn btn-outline btn-sm fd-refresh" onClick={fetchDonations}>
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <SkeletonGrid count={6} />
        ) : error ? (
          <div className="dd-empty">
            <span className="dd-empty__icon">⚠️</span>
            <p>{error}</p>
            <button className="btn btn-primary btn-sm" onClick={fetchDonations}>Try again</button>
          </div>
        ) : donations.length === 0 ? (
          <div className="dd-empty">
            <span className="dd-empty__icon">🌾</span>
            <p>{search ? `No donations match "${search}".` : 'All current donations have been claimed — check back soon!'}</p>
            {!search && (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/donate')}>
                🍱 Be the first donor
              </button>
            )}
          </div>
        ) : (
          <div className="cards-grid">
            {donations.map(d => (
              <div key={d.id} className="dashboard-card fd-card">
                {d.image_path && (
                  <img
                    className="dd-listing-img"
                    src={`${APP_ROOT}${d.image_path}`}
                    alt={d.food_name}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                <div className="dd-card-top">
                  <div className="dd-card-info">
                    <div className="dd-card-title">{d.food_name}</div>
                    <p className="dd-card-meta">📦 {d.quantity}</p>
                    {d.expiry_date && <p className="dd-card-meta">📅 Best before {d.expiry_date}</p>}
                    {d.location && <p className="dd-card-meta">📍 {d.location}</p>}
                    <p className="dd-card-meta">🤝 {d.donor_name || 'Anonymous donor'}</p>
                    {d.description && <p className="dd-card-meta fd-card__desc">{d.description}</p>}
                  </div>
                  <span className="badge badge-green">available</span>
                </div>
                <div className="dd-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={handleRequest}>
                    📦 Request this
                  </button>
                  {d.location && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(d.location)}`, '_blank')}
                    >
                      🗺️ Map
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
