import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

const STATS = [
  { final: 1575, suffix: '+', labelKey: 'impact_meals',     icon: '🍽️' },
  { final: 50,   suffix: '+', labelKey: 'impact_donors',    icon: '🤝' },
  { final: 12,   suffix: '',  labelKey: 'impact_ngos',      icon: '🏢' },
  { final: 8,    suffix: '',  labelKey: 'impact_areas',     icon: '📍' },
];

function useCountUp(target, duration = 1800, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const total = Math.ceil(duration / 16);
    const step = target / total;
    const id = setInterval(() => {
      frame++;
      const next = Math.min(Math.round(step * frame), target);
      setCount(next);
      if (next >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration, active]);
  return count;
}

function StatItem({ stat, active }) {
  const { t } = useLanguage();
  const count = useCountUp(stat.final, 1600, active);
  return (
    <div className="impact-stat">
      <span className="impact-stat__icon">{stat.icon}</span>
      <span className="impact-stat__value">
        {count.toLocaleString()}{stat.suffix}
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
            <StatItem key={stat.labelKey} stat={stat} active={active} />
          ))}
        </div>
        <button className="impact-learn-btn" onClick={() => navigate('/about')}>
          {t('about', 'how_title')} →
        </button>
      </div>
    </section>
  );
}
