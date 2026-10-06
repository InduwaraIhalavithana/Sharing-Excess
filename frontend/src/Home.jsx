import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from './i18n/LanguageContext';
import ImpactSection from './components/ImpactSection';
import Reveal from './components/Reveal.jsx';
import HeroArt from './components/HeroArt';
import { useAuth } from './contexts/AuthContext';
import { usePublicListings, usePublicStats, useFeedbackList } from './hooks/queries';
import './HomeCustom.css';

const HOW_STEPS = [
  { num: '01', icon: '📋', titleKey: 'how_step1_title', descKey: 'how_step1_desc' },
  { num: '02', icon: '🔗', titleKey: 'how_step2_title', descKey: 'how_step2_desc' },
  { num: '03', icon: '🚚', titleKey: 'how_step3_title', descKey: 'how_step3_desc' },
];

const PARTNERS = [
  'Ceylon Biscuits Limited', 'Dilmah Tea', 'MAS Holdings', 'Brandix', 'Red Bull',
  'John Keells Holdings', 'Hemas Holdings', 'Hayleys', 'Dialog Axiata', 'Commercial Bank',
];

const FAQS = [
  { q: 'Who can donate food?', a: 'Anyone — restaurants, hotels, bakeries, event organisers, or households with surplus food. Sign up as a donor, list what you have, and our officers take it from there.' },
  { q: 'Is the food safe? How is it checked?', a: 'Every listing is reviewed by a field officer before it goes public. Expired or unsafe food is rejected at the gate, and donors see the reason why.' },
  { q: 'How do recipients get the food?', a: 'Registered recipients and NGOs browse approved listings and send a request. Once the donor accepts, pickup or delivery is coordinated — and both sides get email updates at every step.' },
  { q: 'Does it cost anything?', a: 'No. The platform is completely free for donors and recipients. Money donations through PayHere are optional and go toward logistics and community food drives.' },
  { q: 'Can I volunteer or partner as an NGO?', a: 'Absolutely! Head to the Contact page and mention volunteering, or email us your organisation details to become a distribution partner.' },
];

export default function Home() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState(0);

  // Live platform data (cached and shared with other pages by TanStack Query)
  const listingsQ = usePublicListings({ limit: 6 });
  const statsQ = usePublicStats();
  const feedbackQ = useFeedbackList();
  const liveListings = listingsQ.data?.listings ?? [];
  const liveTotals = {
    listings: statsQ.data?.listings_available ?? 0,
    requests: statsQ.data?.requests_open ?? 0,
  };
  const testimonials = (feedbackQ.data?.feedback ?? []).filter(f => f.comment).slice(0, 3);

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
            <div className="home-hero__trust">
              <span>✅ Officer-verified listings</span>
              <span>📧 Email updates at every step</span>
              <span>🆓 Free forever</span>
            </div>
            {user && (
              <p className="home-hero__welcome">
                Welcome back, <strong>{user.name || user.email}</strong> ✨
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
                <strong>{liveTotals.listings || '—'} listings</strong>
                <small>available right now</small>
              </div>
            </div>
            <div className="home-hero__float home-hero__float--2">
              <span className="home-hero__float-icon">📬</span>
              <div>
                <strong>{liveTotals.requests || '—'} requests</strong>
                <small>waiting for a donor</small>
              </div>
            </div>
            <div className="home-hero__float home-hero__float--3">
              <span className="home-hero__float-icon">✅</span>
              <div>
                <strong>Verified</strong>
                <small>by field officers</small>
              </div>
            </div>
          </div>
        </div>
      </section>

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
                <span className="home-live__pulse" aria-hidden="true" /> Live on the platform
              </h2>
              <p className="home-live__subtitle">
                Real surplus food, listed by real donors — updated as it happens.
              </p>
            </div>
          </Reveal>
          {liveListings.length > 0 ? (
            <div className="home-live__grid">
              {liveListings.map((l, i) => (
                <Reveal key={l.id} delay={i * 90}>
                  <div className="home-live-card">
                    <div className="home-live-card__top">
                      <span className="home-live-card__emoji">🍲</span>
                      <span className="home-live-card__badge">available</span>
                    </div>
                    <h3 className="home-live-card__name">{l.food_name}</h3>
                    <p className="home-live-card__meta">📦 {l.quantity}</p>
                    {l.location && <p className="home-live-card__meta">📍 {l.location}</p>}
                    {l.expiry_date && <p className="home-live-card__meta">📅 Best before {l.expiry_date}</p>}
                    <button
                      className="home-live-card__btn"
                      onClick={() => navigate(user ? '/recipient-dashboard' : '/food-donations')}
                    >
                      Request this →
                    </button>
                  </div>
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal>
              <div className="home-live__empty">
                <span>🌾</span>
                <p>All current listings have been claimed — check back soon, or <Link to="/donate">be the donor</Link> who fills this space.</p>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────── */}
      {testimonials.length > 0 && (
        <section className="home-testimonials">
          <div className="home-testimonials__inner">
            <Reveal>
              <h2 className="home-testimonials__title">💬 What the community says</h2>
            </Reveal>
            <div className="home-testimonials__grid">
              {testimonials.map((f, i) => (
                <Reveal key={f.id} delay={i * 120}>
                  <figure className="home-testimonial">
                    <div className="home-testimonial__stars" aria-label={`${f.rating || 5} stars`}>
                      {'⭐'.repeat(Math.min(f.rating || 5, 5))}
                    </div>
                    <blockquote>"{f.comment}"</blockquote>
                    <figcaption>
                      <span className="home-testimonial__avatar">
                        {(f.recipient_name || 'A').charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <strong>{f.recipient_name || 'Anonymous'}</strong>
                        <small>{new Date(f.created_at).toLocaleDateString()}</small>
                      </div>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Partner marquee ───────────────────────────── */}
      <section className="home-partners">
        <p className="home-partners__label">Trusted by Sri Lanka's leading organisations</p>
        <div className="home-partners__marquee">
          <div className="home-partners__track">
            {[...PARTNERS, ...PARTNERS].map((p, i) => (
              <span key={i} className="home-partners__item">🏢 {p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────── */}
      <section className="home-faq">
        <div className="home-faq__inner">
          <Reveal>
            <h2 className="home-faq__title">Frequently Asked Questions</h2>
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
                    <span>{f.q}</span>
                    <span className="home-faq__chevron" aria-hidden="true">▾</span>
                  </button>
                  <div className="home-faq__a">
                    <p>{f.a}</p>
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
