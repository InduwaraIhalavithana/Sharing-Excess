import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from './i18n/LanguageContext.jsx';
import ImpactSection from './components/ImpactSection';
import './HomeCustom.css';

const STATS = [
  { value: '1,575', key: 'stats_meals',  icon: '🍽️' },
  { value: '50+',   key: 'stats_donors', icon: '🤝' },
  { value: '12',    key: 'stats_ngos',   icon: '🏢' },
  { value: '8',     key: 'stats_areas',  icon: '📍' },
];

const HOW_STEPS = [
  { num: '01', icon: '📋', titleKey: 'how_step1_title', descKey: 'how_step1_desc' },
  { num: '02', icon: '🔗', titleKey: 'how_step2_title', descKey: 'how_step2_desc' },
  { num: '03', icon: '🚚', titleKey: 'how_step3_title', descKey: 'how_step3_desc' },
];

export default function Home() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      setUser(stored ? JSON.parse(stored) : null);
    } catch { setUser(null); }

    const onStorage = () => {
      try {
        const s = localStorage.getItem('user');
        setUser(s ? JSON.parse(s) : null);
      } catch { setUser(null); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!statsRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.2 }
    );
    observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const handleDonate  = () => navigate(user ? '/donor-dashboard' : '/donate');
  const handleReceive = () => navigate(user ? '/recipient-dashboard' : '/food-donations');
  const handleGetStarted = () => {
    if (user) navigate('/donor-dashboard');
    else window.dispatchEvent(new CustomEvent('openSignup'));
  };

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────── */}
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-hero__text">
            <span className="home-hero__badge">🌱 Fighting Food Waste in Sri Lanka</span>
            <h1 className="home-hero__title">
              {t('home', 'hero_title')}<br />
              <span className="home-hero__title-accent">{t('home', 'hero_title2')}</span>
            </h1>
            <p className="home-hero__subtitle">{t('home', 'hero_subtitle')}</p>
            <div className="home-hero__ctas">
              <button className="home-cta-primary" onClick={handleDonate}>
                🍽️ {t('home', 'donate_btn')}
              </button>
              <button className="home-cta-secondary" onClick={handleReceive}>
                📦 {t('home', 'receive_btn')}
              </button>
            </div>
            {user && (
              <p className="home-hero__welcome">
                Welcome back, <strong>{user.name || user.email}</strong> ✨
              </p>
            )}
          </div>
          <div className="home-hero__media">
            <div className="home-hero__img-wrap">
              <img
                src="/slideshow/slide5.jpg"
                alt="World Hunger Day — May 28"
                className="home-hero__static-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────── */}
      <section className="home-stats" ref={statsRef}>
        <div className="home-stats__inner">
          {STATS.map(({ value, key, icon }, i) => (
            <div
              key={key}
              className={`home-stat-item${statsVisible ? ' visible' : ''}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <span className="home-stat-icon">{icon}</span>
              <span className="home-stat-value">{value}</span>
              <span className="home-stat-label">{t('home', key)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────── */}
      <section className="home-how">
        <div className="home-how__inner">
          <div className="home-how__header">
            <h2 className="home-how__title">{t('home', 'how_title')}</h2>
            <p className="home-how__subtitle">{t('home', 'how_subtitle')}</p>
          </div>
          <div className="home-how__steps">
            {HOW_STEPS.map(({ num, icon, titleKey, descKey }, i) => (
              <div key={titleKey} className="home-how__step">
                <div className="home-how__step-header">
                  <span className="home-how__step-num">{num}</span>
                  <span className="home-how__step-icon">{icon}</span>
                </div>
                <h3 className="home-how__step-title">{t('home', titleKey)}</h3>
                <p className="home-how__step-desc">{t('home', descKey)}</p>
                {i < HOW_STEPS.length - 1 && (
                  <span className="home-how__connector" aria-hidden="true">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Impact Section ────────────────────────────── */}
      <ImpactSection />

      {/* ── CTA Banner ────────────────────────────────── */}
      <section className="home-cta-banner">
        <div className="home-cta-banner__inner">
          <div className="home-cta-banner__leaf" aria-hidden="true">🍀</div>
          <h2 className="home-cta-banner__title">{t('home', 'cta_title')}</h2>
          <p className="home-cta-banner__subtitle">{t('home', 'cta_subtitle')}</p>
          <div className="home-cta-banner__btns">
            <button className="home-cta-primary home-cta-primary--white" onClick={handleGetStarted}>
              {t('home', 'cta_btn')} →
            </button>
            <button className="home-cta-ghost" onClick={() => navigate('/about')}>
              {t('home', 'cta_secondary')}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
