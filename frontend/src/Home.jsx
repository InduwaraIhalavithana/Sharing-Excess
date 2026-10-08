import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from './i18n/LanguageContext';
import { tr } from './i18n/phrases';
import ImpactSection from './components/ImpactSection';
import HungerSection from './components/HungerSection';
import Reveal from './components/Reveal.jsx';
import HeroArt from './components/HeroArt';
import { WHO_ITS_FOR } from './data/audience';
import { useAuth } from './contexts/AuthContext';
import { usePublicListings, usePublicStats } from './hooks/queries';
import { CATEGORY_ICON, qty, timeLeft } from './utils/format';
import './HomeCustom.css';

const HOW_STEPS = [
  { num: '01', icon: '📋', titleKey: 'how_step1_title', descKey: 'how_step1_desc' },
  { num: '02', icon: '🔗', titleKey: 'how_step2_title', descKey: 'how_step2_desc' },
  { num: '03', icon: '🚚', titleKey: 'how_step3_title', descKey: 'how_step3_desc' },
];

const FAQS = [
  { q: tr('Who can donate food?'), a: tr('Anyone with surplus food: restaurants, hotels, bakeries, event organisers or households. Sign up as a donor, add a photo, the quantity and when it expires, and tick that it is safe to eat. Your listing goes live straight away.') },
  { q: tr('Is the food safe?'), a: tr('Donors confirm that the food is safe and not expired every time they post, and recipients can see photos, when it was prepared and when it expires. Anyone can report a listing, and the admin removes anything unsafe.') },
  { q: tr('How do recipients get the food?'), a: tr('Recipients and approved NGOs see food in their own district first, then neighbouring districts. Ask for all of it or just part, and the quantity is held for you until the donor answers. When they accept, you receive their contact details to arrange pickup or delivery.') },
  { q: tr('Is my address public?'), a: tr('No. Visitors only ever see the district and town. The exact address and phone number are shared only with the one recipient whose request the donor has accepted.') },
  { q: tr('Can my organisation join as an NGO?'), a: tr('Yes. Sign up as an NGO; once the admin approves your organisation you can post events, appear in the NGO directory and request food.') },
];

export default function Home() {
  const { t, p } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState(0);

  // Live platform data (cached and shared with other pages by TanStack Query)
  const listingsQ = usePublicListings({ limit: 6 });
  const statsQ = usePublicStats();
  const liveListings = listingsQ.data?.listings ?? [];
  const liveTotals = {
    listings: statsQ.data?.listings_available ?? 0,
    requests: statsQ.data?.requests_open ?? 0,
  };

  const handleDonate  = () => navigate('/post-food');
  const handleReceive = () => navigate('/food');
  const handleGetStarted = () => {
    if (user) navigate('/food');
    else window.dispatchEvent(new CustomEvent('openSignup'));
  };

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────── */}
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-hero__text">
            <span className="home-hero__badge">{p('🌱 Fighting Food Waste in Sri Lanka')}</span>
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
            <div className="home-hero__trust">
              <span>{p('🔒 Contact shared only after you accept')}</span>
              <span>{p('📧 Email updates at every step')}</span>
              <span>{p('🆓 Free forever')}</span>
            </div>
            {user && (
              <p className="home-hero__welcome">
                {p('Welcome back,')} <strong>{user.name || user.email}</strong> ✨
              </p>
            )}
          </div>
          <div className="home-hero__media">
            <div className="home-hero__img-wrap">
              <HeroArt />
            </div>
            <div className="home-hero__float home-hero__float--1">
              <span className="home-hero__float-icon">🥖</span>
              <div>
                <strong>{liveTotals.listings || '—'} {p('listings')}</strong>
                <small>{p('available right now')}</small>
              </div>
            </div>
            <div className="home-hero__float home-hero__float--2">
              <span className="home-hero__float-icon">📬</span>
              <div>
                <strong>{liveTotals.requests || '—'} {p('requests')}</strong>
                <small>{p('waiting for a donor')}</small>
              </div>
            </div>
            <div className="home-hero__float home-hero__float--3">
              <span className="home-hero__float-icon">✅</span>
              <div>
                <strong>{p('Nearby first')}</strong>
                <small>{p('your district, then neighbours')}</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why it matters: the hunger problem, with sourced figures ── */}
      <HungerSection />

      {/* ── Impact counters (single, animated) ────────── */}
      <ImpactSection />

      {/* ── How It Works ──────────────────────────────── */}
      <section className="home-how">
        <div className="home-how__inner">
          <Reveal>
            <div className="home-how__header">
              <h2 className="home-how__title">{t('home', 'how_title')}</h2>
              <p className="home-how__subtitle">{t('home', 'how_subtitle')}</p>
            </div>
          </Reveal>
          <div className="home-how__steps">
            {HOW_STEPS.map(({ num, icon, titleKey, descKey }, i) => (
              <Reveal key={titleKey} delay={i * 120}>
                <div className="home-how__step">
                  <div className="home-how__step-header">
                    <span className="home-how__step-num">{num}</span>
                    <span className="home-how__step-icon">{icon}</span>
                  </div>
                  <h3 className="home-how__step-title">{t('home', titleKey)}</h3>
                  <p className="home-how__step-desc">{t('home', descKey)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live right now ────────────────────────────── */}
      <section className="home-live">
        <div className="home-live__inner">
          <Reveal>
            <div className="home-live__header">
              <h2 className="home-live__title">
                <span className="home-live__pulse" aria-hidden="true" /> {p('Live on the platform')}
              </h2>
              <p className="home-live__subtitle">
                {p('Real surplus food, listed by real donors — updated as it happens.')}
              </p>
            </div>
          </Reveal>
          {liveListings.length > 0 ? (
            <div className="home-live__grid">
              {liveListings.map((l, i) => (
                <Reveal key={l.id} delay={i * 90}>
                  <div className="home-live-card" data-cat={l.category}>
                    <div className="home-live-card__top">
                      <span className="home-live-card__emoji">{CATEGORY_ICON[l.category] ?? '🍲'}</span>
                      <span className="home-live-card__badge">{p('available')}</span>
                    </div>
                    <h3 className="home-live-card__name">{l.food_name}</h3>
                    <p className="home-live-card__meta">📦 {qty(l.quantity_available)} {l.unit} {p('left')}</p>
                    <p className="home-live-card__meta">📍 {l.district}{l.area ? ` · ${l.area}` : ''}</p>
                    <p className="home-live-card__meta">⏱ {timeLeft(l.expires_at).text} {p('left')}</p>
                    <button
                      className="home-live-card__btn"
                      onClick={() => navigate(`/listings/${l.id}`)}
                    >
                      {p('Request this →')}
                    </button>
                  </div>
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal>
              <div className="home-live__empty">
                <span>🌾</span>
                <p>{p('All current listings have been claimed — check back soon, or')} <Link to="/post-food">{p('be the donor')}</Link> {p('who fills this space.')}</p>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ── Partner marquee ───────────────────────────── */}
      <section className="home-partners">
        <p className="home-partners__label">{p('Built for the people who share and receive food')}</p>
        <div className="home-partners__marquee">
          <div className="home-partners__track">
            {[...WHO_ITS_FOR, ...WHO_ITS_FOR].map((item, i) => (
              <span key={i} className="home-partners__item">{p(item)}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────── */}
      <section className="home-faq">
        <div className="home-faq__inner">
          <Reveal>
            <h2 className="home-faq__title">{p('Frequently Asked Questions')}</h2>
          </Reveal>
          <div className="home-faq__list">
            {FAQS.map((f, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className={`home-faq__item${openFaq === i ? ' open' : ''}`}>
                  <button
                    className="home-faq__q"
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    aria-expanded={openFaq === i}
                  >
                    <span>{p(f.q)}</span>
                    <span className="home-faq__chevron" aria-hidden="true">▾</span>
                  </button>
                  <div className="home-faq__a">
                    <p>{p(f.a)}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

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
