import { useLanguage } from '../i18n/LanguageContext';
import Reveal from './Reveal.jsx';

const STATS = [
  { value: '1,575+', label: 'Meals Distributed', icon: '🍽️' },
  { value: '50+',    label: 'Active Donors',     icon: '🤝' },
  { value: '25+',    label: 'Partner NGOs',      icon: '🏢' },
  { value: '2.5T',   label: 'Food Saved',        icon: '♻️' },
];

const WHY = [
  { icon: '👥', title: 'Food Insecurity',    body: 'Over 800,000 Sri Lankans face food insecurity every year' },
  { icon: '🗑️', title: 'Food Waste',        body: '1/3 of all food produced globally is lost or wasted' },
  { icon: '🌡️', title: 'Climate Impact',    body: 'Food waste is a major contributor to greenhouse gas emissions' },
  { icon: '♻️', title: 'Circular Solution', body: 'Redistributing surplus food saves lives and protects the planet' },
];

const HOW = [
  { num: '1', title: 'List',       body: 'Restaurants, hotels, and households list surplus food on our platform' },
  { num: '2', title: 'Verify',     body: 'Field officers review every listing for safety before it goes public' },
  { num: '3', title: 'Match',      body: 'NGOs and recipients browse available food and request what they need' },
  { num: '4', title: 'Deliver',    body: 'Pickups are coordinated, delivery is tracked, and impact is measured' },
];

const TIMELINE = [
  { icon: '💡', title: 'The Idea',            body: 'Watching perfectly good food go to waste while communities struggled sparked the question: what if surplus could reach the people who need it, the same day?' },
  { icon: '🏗️', title: 'Building the Platform', body: 'Designed and built end-to-end as a solo project — the FastAPI backend, PostgreSQL database, React frontend, and everything in between.' },
  { icon: '🔐', title: 'Making It Trustworthy', body: 'Added officer verification for every listing, JWT-secured roles, email notifications, and PayHere donations — so donors and recipients can trust the process.' },
  { icon: '🚀', title: 'Today & Beyond',       body: 'A fully working food redistribution platform for Sri Lanka — with multilingual support, dark mode, and a growing feature set. This is just the beginning.' },
];

const TECH = [
  { group: 'Frontend',  items: ['⚛️ React 19', '⚡ Vite', '🧭 React Router', '📊 Chart.js'] },
  { group: 'Backend',   items: ['🐍 FastAPI', '🐘 PostgreSQL', '🧱 SQLAlchemy', '🔑 JWT Auth'] },
  { group: 'Services',  items: ['💳 PayHere', '📧 SMTP Email', '☁️ Cloudinary', '🐳 Docker'] },
  { group: 'Quality',   items: ['🧪 pytest (31 tests)', '🌍 3 Languages', '🌙 Dark Mode', '📱 Responsive'] },
];

export default function About() {
  const { t } = useLanguage();

  return (
    <div className="about-page">
      {/* Hero */}
      <div className="about-hero">
        <div className="container">
          <h1 className="about-hero__title">About Sharing Excess</h1>
          <p className="about-hero__sub">Fighting hunger, reducing waste, building community across Sri Lanka</p>
          <div className="about-hero__cta">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => window.dispatchEvent(new Event('openSignup'))}
            >
              Become a Donor
            </button>
            <a href="#mission" className="btn btn-secondary btn-lg">Learn More</a>
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
                <h2>Our Mission</h2>
                <p>
                  Every year, millions of tons of food are wasted while countless families go hungry.
                  In Sri Lanka alone, food insecurity affects thousands of children and adults daily.
                  Meanwhile, surplus food from restaurants, events, and households ends up in landfills.
                </p>
                <p className="about-mission__highlight">
                  <em>Imagine a world where no meal goes to waste and no person goes to bed hungry.</em>
                </p>
              </div>
              <div className="about-vision card">
                <span className="about-vision__icon">🤝</span>
                <div>
                  <h3>Our Vision</h3>
                  <p>
                    <strong>Sharing Excess</strong> bridges the gap between surplus and scarcity.
                    Our mission is to create a sustainable system where leftover food is redirected
                    to trusted NGOs, minimising waste and maximising impact.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Impact stats */}
        <section className="about-section about-section--band">
          <Reveal>
            <h2 className="about-section-title">Our Impact</h2>
          </Reveal>
          <div className="about-stats">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 100}>
                <div className="about-stat card">
                  <span className="about-stat__icon">{s.icon}</span>
                  <span className="about-stat__value">{s.value}</span>
                  <span className="about-stat__label">{s.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Why it matters */}
        <section className="about-section">
          <Reveal>
            <h2 className="about-section-title">Why This Matters</h2>
          </Reveal>
          <div className="about-cards">
            {WHY.map((w, i) => (
              <Reveal key={w.title} delay={i * 90}>
                <div className="about-card card">
                  <span className="about-card__icon">{w.icon}</span>
                  <h3>{w.title}</h3>
                  <p>{w.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="about-section">
          <Reveal>
            <h2 className="about-section-title">How It Works</h2>
          </Reveal>
          <div className="about-steps">
            {HOW.map((h, i) => (
              <Reveal key={h.num} delay={i * 90}>
                <div className="about-step">
                  <div className="about-step__num">{h.num}</div>
                  <div className="about-step__body">
                    <h3>{h.title}</h3>
                    <p>{h.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Meet the developer — solo project */}
        <section className="about-section about-section--band">
          <Reveal>
            <h2 className="about-section-title">Meet the Developer</h2>
          </Reveal>
          <Reveal>
            <div className="about-dev card">
              <div className="about-dev__left">
                <div className="about-dev__avatar">👨‍💻</div>
                <h3 className="about-dev__name">Induwara Ihalavithana</h3>
                <p className="about-dev__role">Founder · Designer · Developer</p>
                <p className="about-dev__uni">🎓 Uva Wellassa University, Badulla</p>
              </div>
              <div className="about-dev__right">
                <p className="about-dev__bio">
                  Sharing Excess is a <strong>solo project</strong> — conceived, designed, and built
                  entirely by one developer with a simple conviction: technology should make it
                  effortless for surplus food to reach the people who need it.
                </p>
                <p className="about-dev__bio">
                  From the FastAPI backend and PostgreSQL database to the React frontend,
                  the officer verification workflow, payment integration, and trilingual UI —
                  every line of this platform was written to fight hunger and food waste in Sri Lanka.
                </p>
                <div className="about-dev__badges">
                  <span>💻 Full-Stack Development</span>
                  <span>🎨 UI/UX Design</span>
                  <span>🗄️ Database Architecture</span>
                  <span>🔐 Security & Auth</span>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Project timeline */}
        <section className="about-section">
          <Reveal>
            <h2 className="about-section-title">The Journey</h2>
          </Reveal>
          <div className="about-timeline">
            {TIMELINE.map((tl, i) => (
              <Reveal key={tl.title} delay={i * 110}>
                <div className="about-timeline__item">
                  <div className="about-timeline__marker">
                    <span>{tl.icon}</span>
                  </div>
                  <div className="about-timeline__content card">
                    <h3>{tl.title}</h3>
                    <p>{tl.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Tech stack */}
        <section className="about-section">
          <Reveal>
            <h2 className="about-section-title">Built With</h2>
          </Reveal>
          <div className="about-tech">
            {TECH.map((tg, i) => (
              <Reveal key={tg.group} delay={i * 90}>
                <div className="about-tech__group card">
                  <h3>{tg.group}</h3>
                  <div className="about-tech__chips">
                    {tg.items.map(item => (
                      <span key={item} className="about-tech__chip">{item}</span>
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
            <h2>Join Us in Making a Difference</h2>
            <p>Whether you are a business, NGO, or individual — you can help fight hunger and food waste.</p>
            <div className="about-cta__btns">
              <button
                className="btn btn-primary btn-lg"
                onClick={() => window.dispatchEvent(new Event('openSignup'))}
              >
                Get Started
              </button>
              <a href="/contact" className="btn btn-outline btn-lg">Contact Us</a>
            </div>
          </section>
        </Reveal>

        {/* Contact strip */}
        <section className="about-section">
          <Reveal>
            <h2 className="about-section-title">Get In Touch</h2>
          </Reveal>
          <Reveal>
            <div className="about-contact">
              {[
                { icon: '📧', label: 'Email',   value: 'info@sharingexcess.lk' },
                { icon: '📞', label: 'Phone',   value: '+94 77 123 4567' },
                { icon: '📍', label: 'Address', value: 'Uva Wellassa University, Badulla, Sri Lanka' },
              ].map(c => (
                <div key={c.label} className="about-contact-item card">
                  <span className="about-contact-item__icon">{c.icon}</span>
                  <div>
                    <strong>{c.label}</strong>
                    <p>{c.value}</p>
                  </div>
                </div>
              ))}
              <div className="about-contact-item card">
                <span className="about-contact-item__icon">🌐</span>
                <div>
                  <strong>Follow Us</strong>
                  <div className="about-social__links">
                    {['📘', '🐦', '📷', '💼'].map((icon, i) => (
                      <span key={i} className="about-social__link">{icon}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

      </div>
    </div>
  );
}
