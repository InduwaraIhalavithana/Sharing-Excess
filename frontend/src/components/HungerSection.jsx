import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useCountUp } from '../hooks/useCountUp';
import Reveal from './Reveal.jsx';
import HungerScene from './HungerScene';
import SriLankaMap from './SriLankaMap';
import './HungerSection.css';

// Figures are from published reports; the source is shown on every card and linked below.
const STATS = ['s1', 's2', 's3'];
const SOURCES = [
  { label: 'FAO, SOFI 2025', href: 'https://www.fao.org/newsroom/detail/sofi-2025--fao-calls-for-urgent--coordinated-and-inclusive-action-to-end-global-hunger' },
  { label: 'UNEP Food Waste Index 2024', href: 'https://news.un.org/en/node/1148036' },
  { label: 'WFP Sri Lanka, 2022', href: 'https://english.newsfirst.lk/2023/5/10/1-3-of-sri-lanka-acutely-food-insecure-in-2022-wfp' },
];

function HungerStat({ id, active, delay }) {
  const { t } = useLanguage();
  const target = Number(t('hunger', `${id}_value`)) || 0;
  const count = useCountUp(target, 1700, active);
  return (
    <Reveal delay={delay}>
      <div className="hunger-stat">
        <div className="hunger-stat__figure">
          <span className="hunger-stat__value">{count.toLocaleString()}</span>
          <span className="hunger-stat__unit">{t('hunger', `${id}_unit`)}</span>
        </div>
        <p className="hunger-stat__label">{t('hunger', `${id}_label`)}</p>
        <span className="hunger-stat__src">{t('hunger', `${id}_src`)}</span>
      </div>
    </Reveal>
  );
}

export default function HungerSection() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); obs.disconnect(); } },
      { threshold: 0.2 },
    );
    obs.observe(el);
    const fallback = setTimeout(() => setActive(true), 3000);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, []);

  return (
    <section className="hunger" ref={ref} aria-labelledby="hunger-title">
      <HungerScene />
      <div className="hunger__shade" aria-hidden="true" />
      <div className="hunger__inner">
        <div className="hunger__copy">
          <Reveal>
            <span className="hunger__eyebrow">{t('hunger', 'eyebrow')}</span>
            <h2 id="hunger-title" className="hunger__title">{t('hunger', 'title')}</h2>
            <p className="hunger__subtitle">{t('hunger', 'subtitle')}</p>
          </Reveal>
          <div className="hunger__stats">
            {STATS.map((id, i) => (
              <HungerStat key={id} id={id} active={active} delay={i * 140} />
            ))}
          </div>
          <Reveal delay={420}>
            <div className="hunger__ctas">
              <button className="home-cta-primary" onClick={() => navigate('/post-food')}>
                🍽️ {t('home', 'donate_btn')}
              </button>
              <button className="hunger__cta-ghost" onClick={() => navigate('/food')}>
                📦 {t('home', 'receive_btn')}
              </button>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200} className="hunger__map-wrap">
          <figure className="hunger__map">
            <SriLankaMap label={t('hunger', 'map_label')} />
            <figcaption>{t('hunger', 'map_caption')}</figcaption>
          </figure>
        </Reveal>
      </div>

      <p className="hunger__sources">
        {t('hunger', 'sources')}:{' '}
        {SOURCES.map((s, i) => (
          <span key={s.href}>
            <a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>
            {i < SOURCES.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </p>
    </section>
  );
}
