import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { usePublicStats } from '../hooks/queries';
import { useCountUp } from '../hooks/useCountUp';

// Live numbers from the database (GET /api/public/stats) - nothing here is hardcoded
const STATS = [
  { field: 'meals_delivered', labelKey: 'impact_meals',      icon: '🍽️' },
  { field: 'donors',          labelKey: 'impact_donors',     icon: '🤝' },
  { field: 'recipients',      labelKey: 'impact_recipients', icon: '🏢' },
  { field: 'listings_shared', labelKey: 'impact_listings',   icon: '📍' },
];

function StatItem({ stat, active, value }) {
  const { t } = useLanguage();
  const count = useCountUp(value, 1600, active);
  return (
    <div className="impact-stat">
      <span className="impact-stat__icon">{stat.icon}</span>
      <span className="impact-stat__value">
        {count.toLocaleString()}
      </span>
      <span className="impact-stat__label">{t('about', stat.labelKey)}</span>
    </div>
  );
}

export default function ImpactSection() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const [active, setActive] = useState(false);
  const { data: stats } = usePublicStats();

  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(sectionRef.current);
    // Fallback: never leave the counters stuck at 0 if the observer misses
    const fallback = setTimeout(() => setActive(true), 2500);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, []);

  return (
    <section className="impact-section" ref={sectionRef}>
      <div className="impact-inner">
        <div className="impact-heading">
          <h2 className="impact-title">{t('about', 'stats_title')}</h2>
          <p className="impact-subtitle">{t('home', 'mission_text')}</p>
        </div>
        <div className="impact-stats-grid">
          {STATS.map(stat => (
            <StatItem key={stat.labelKey} stat={stat} active={active} value={stats?.[stat.field] ?? 0} />
          ))}
        </div>
        <button className="impact-learn-btn" onClick={() => navigate('/about')}>
          {t('about', 'how_title')} →
        </button>
      </div>
    </section>
  );
}
