import Reveal from './Reveal.jsx';
import { useLanguage } from '../i18n/LanguageContext';
import { tr } from '../i18n/phrases';
import { usePublicStats } from '../hooks/queries';

// Live numbers (GET /api/public/stats)
const STATS = [
  { field: 'handovers_completed', label: tr('Handovers Completed'), icon: '🍽️' },
  { field: 'donors',          label: tr('Active Donors'),       icon: '🤝' },
  { field: 'recipients',      label: tr('Registered Recipients'), icon: '🏢' },
  { field: 'listings_shared', label: tr('Listings Shared'),     icon: '♻️' },
];

const WHY = [
  { icon: '👥', title: tr('Food Insecurity'),    body: tr('Over 6 million Sri Lankans were food insecure in 2022 (WFP)') },
  { icon: '🗑️', title: tr('Food Waste'),        body: tr('1/3 of all food produced globally is lost or wasted') },
  { icon: '🌡️', title: tr('Climate Impact'),    body: tr('Food waste is a major contributor to greenhouse gas emissions') },
  { icon: '♻️', title: tr('Circular Solution'), body: tr('Redistributing surplus food saves lives and protects the planet') },
];

const HOW = [
  { num: '1', title: tr('List'),       body: tr('Restaurants, hotels, and households list surplus food on our platform') },
  { num: '2', title: tr('Go live'),    body: tr('The listing is visible at once, nearest district first, with photos and the expiry time') },
  { num: '3', title: tr('Request'),    body: tr('Recipients and NGOs ask for all or part of it; the quantity is held until the donor answers') },
  { num: '4', title: tr('Hand over'),  body: tr('On acceptance the donor and recipient share contact details, arrange pickup, then rate each other') },
];

const TIMELINE = [
  { icon: '💡', title: tr('The Idea'),            body: tr('Watching perfectly good food go to waste while communities struggled sparked the question: what if surplus could reach the people who need it, the same day?') },
  { icon: '🏗️', title: tr('Building the Platform'), body: tr('Designed and built end-to-end as a solo project — the FastAPI backend, PostgreSQL database, React frontend, and everything in between.') },
  { icon: '🔐', title: tr('Making It Trustworthy'), body: tr('Added district-first matching, held stock, private contact details until a donor accepts, two-way ratings, NGO approval, and alerts by bell and email — so donors and recipients can trust the process.') },
  { icon: '🚀', title: tr('Today & Beyond'),       body: tr('A fully working food redistribution platform for Sri Lanka — with multilingual support, dark mode, and a growing feature set. This is just the beginning.') },
];

const TECH = [
  { group: tr('Frontend'),  items: ['⚛️ React 19', '⚡ Vite', '🧭 React Router', '📊 Chart.js'] },
  { group: tr('Backend'),   items: ['🐍 FastAPI', '🐘 PostgreSQL', '🧱 SQLAlchemy', '🔑 JWT Auth'] },
  { group: tr('Services'),  items: ['📧 SMTP Email', '☁️ Cloudinary', '🐳 Docker'] },
  { group: tr('Quality'),   items: ['🧪 pytest', tr('🌍 3 Languages'), tr('🌙 Dark Mode'), tr('📱 Responsive')] },
];

export default function About() {
  const { data: stats } = usePublicStats();
  const { p } = useLanguage();

  return (
    <div className="about-page">
      {/* Hero */}
      <div className="about-hero">
        <div className="container">
          <h1 className="about-hero__title">{p('About Sharing Excess')}</h1>
          <p className="about-hero__sub">{p('Fighting hunger, reducing waste, building community across Sri Lanka')}</p>
          <div className="about-hero__cta">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => window.dispatchEvent(new Event('openSignup'))}
            >
              {p('Become a Donor')}
            </button>
            <a href="#mission" className="btn btn-secondary btn-lg">{p('Learn More')}</a>
          </div>
        </div>
      </div>

      <div className="container about-body">

        {/* Mission + Vision side by side */}
        <section id="mission" className="about-section">
          <Reveal>
            <div className="about-mv-grid">
              <div className="about-mission card">
                <div className="about-mission__icon">🌍</div>
                <h2>{p('Our Mission')}</h2>
                <p>{p('Every year, millions of tons of food are wasted while countless families go hungry. In Sri Lanka alone, food insecurity affects thousands of children and adults daily. Meanwhile, surplus food from restaurants, events, and households ends up in landfills.')}</p>
                <p className="about-mission__highlight">
                  <em>{p('Imagine a world where no meal goes to waste and no person goes to bed hungry.')}</em>
                </p>
              </div>
              <div className="about-vision card">
                <span className="about-vision__icon">🤝</span>
                <div>
                  <h3>{p('Our Vision')}</h3>
                  <p>{p('Sharing Excess bridges the gap between surplus and scarcity. Our mission is to create a sustainable system where leftover food is redirected to trusted NGOs, minimising waste and maximising impact.')}</p>
                  <p>{p('Every donor, recipient and NGO we connect brings us closer to a Sri Lanka where good food always finds a table.')}</p>
                  <p className="about-vision__highlight"><em>{p('One surplus meal, shared with a neighbour in need.')}</em></p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Impact stats */}
        <section className="about-section about-section--band">
          <Reveal>
            <h2 className="about-section-title">{p('Our Impact')}</h2>
          </Reveal>
          <div className="about-stats">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 100}>
                <div className="about-stat card">
                  <span className="about-stat__icon">{s.icon}</span>
                  <span className="about-stat__value">{(stats?.[s.field] ?? 0).toLocaleString()}</span>
                  <span className="about-stat__label">{p(s.label)}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Why it matters */}
        <section className="about-section">
          <Reveal>
            <h2 className="about-section-title">{p('Why This Matters')}</h2>
          </Reveal>
          <div className="about-cards">
            {WHY.map((w, i) => (
              <Reveal key={w.title} delay={i * 90}>
                <div className="about-card card">
                  <span className="about-card__icon">{w.icon}</span>
                  <h3>{p(w.title)}</h3>
                  <p>{p(w.body)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="about-section">
          <Reveal>
            <h2 className="about-section-title">{p('How It Works')}</h2>
          </Reveal>
          <div className="about-steps">
            {HOW.map((h, i) => (
              <Reveal key={h.num} delay={i * 90}>
                <div className="about-step">
                  <div className="about-step__num">{h.num}</div>
                  <div className="about-step__body">
                    <h3>{p(h.title)}</h3>
                    <p>{p(h.body)}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Meet the developer — solo project */}
        <section className="about-section about-section--band">
          <Reveal>
            <h2 className="about-section-title">{p('Meet the Developer')}</h2>
          </Reveal>
          <Reveal>
            <div className="about-dev card">
              <div className="about-dev__left">
                <div className="about-dev__avatar"><img src="/developer.webp" alt="Induwara Ihalavithana, the developer of Sharing Excess" width="160" height="160" loading="lazy" /></div>
                <h3 className="about-dev__name">Induwara Ihalavithana</h3>
                <p className="about-dev__role">{p('Founder · Designer · Developer')}</p>
                <p className="about-dev__uni">{p('🎓 Uva Wellassa University, Badulla')}</p>
              </div>
              <div className="about-dev__right">
                <p className="about-dev__bio">
                  {p('Sharing Excess is a solo project — conceived, designed, and built entirely by one developer with a simple conviction: technology should make it effortless for surplus food to reach the people who need it.')}
                </p>
                <p className="about-dev__bio">
                  {p('From the FastAPI backend and PostgreSQL database to the React frontend, the district-first matching, stock tracking, ratings, and trilingual UI — every line of this platform was written to fight hunger and food waste in Sri Lanka.')}
                </p>
                <div className="about-dev__badges">
                  <span>{p('💻 Full-Stack Development')}</span>
                  <span>{p('🎨 UI/UX Design')}</span>
                  <span>{p('🗄️ Database Architecture')}</span>
                  <span>{p('🔐 Security & Auth')}</span>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Project timeline */}
        <section className="about-section">
          <Reveal>
            <h2 className="about-section-title">{p('The Journey')}</h2>
          </Reveal>
          <div className="about-timeline">
            {TIMELINE.map((tl, i) => (
              <Reveal key={tl.title} delay={i * 110}>
                <div className="about-timeline__item">
                  <div className="about-timeline__marker">
                    <span>{tl.icon}</span>
                  </div>
                  <div className="about-timeline__content card">
                    <h3>{p(tl.title)}</h3>
                    <p>{p(tl.body)}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Tech stack */}
        <section className="about-section">
          <Reveal>
            <h2 className="about-section-title">{p('Built With')}</h2>
          </Reveal>
          <div className="about-tech">
            {TECH.map((tg, i) => (
              <Reveal key={tg.group} delay={i * 90}>
                <div className="about-tech__group card">
                  <h3>{p(tg.group)}</h3>
                  <div className="about-tech__chips">
                    {tg.items.map(item => (
                      <span key={item} className="about-tech__chip">{p(item)}</span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <Reveal>
          <section className="about-cta">
            <h2>{p('Join Us in Making a Difference')}</h2>
            <p>{p('Whether you are a business, NGO, or individual — you can help fight hunger and food waste.')}</p>
            <div className="about-cta__btns">
              <button
                className="btn btn-primary btn-lg"
                onClick={() => window.dispatchEvent(new Event('openSignup'))}
              >
                {p('Get Started')}
              </button>
              <a href="/contact" className="btn btn-outline btn-lg">{p('Contact Us')}</a>
            </div>
          </section>
        </Reveal>

        {/* Contact strip */}
        <section className="about-section">
          <Reveal>
            <h2 className="about-section-title">{p('Get In Touch')}</h2>
          </Reveal>
          <Reveal>
            <div className="about-contact">
              {[
                { icon: '📧', label: tr('Email'),   value: 'admin.sharingexcess@gmail.com' },
                { icon: '📍', label: tr('Address'), value: tr('Uva Wellassa University, Badulla, Sri Lanka') },
                { icon: '🕑', label: tr('Hours'),   value: tr('Mon – Fri, 9am – 5pm') },
              ].map(c => (
                <div key={c.label} className="about-contact-item card">
                  <span className="about-contact-item__icon">{c.icon}</span>
                  <div>
                    <strong>{p(c.label)}</strong>
                    <p>{p(c.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

      </div>
    </div>
  );
}
