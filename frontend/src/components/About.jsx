import { useLanguage } from '../i18n/LanguageContext.jsx';

const STATS = [
  { value: '1,575+', label: 'Meals Distributed' },
  { value: '50+',    label: 'Active Donors' },
  { value: '25+',    label: 'Partner NGOs' },
  { value: '2.5T',   label: 'Food Saved' },
];

const WHY = [
  { icon: '👥', title: 'Food Insecurity',    body: 'Over 800,000 Sri Lankans face food insecurity every year' },
  { icon: '🗑️', title: 'Food Waste',        body: '1/3 of all food produced globally is lost or wasted' },
  { icon: '🌡️', title: 'Climate Impact',    body: 'Food waste is a major contributor to greenhouse gas emissions' },
  { icon: '♻️', title: 'Circular Solution', body: 'Redistributing surplus food saves lives and protects the planet' },
];

const HOW = [
  { num: '1', title: 'List',       body: 'Restaurants, hotels, and households list surplus food on our platform' },
  { num: '2', title: 'Match',      body: 'NGOs and recipients browse available food and request what they need' },
  { num: '3', title: 'Coordinate', body: 'Admins coordinate safe, timely pickups and deliveries' },
  { num: '4', title: 'Impact',     body: 'Less waste, more full stomachs, and a healthier planet for everyone' },
];

const TEAM = [
  { avatar: '👨‍💼', name: 'Induwara Ihalavithana', role: 'Founder & CEO',       bio: 'Passionate about fighting hunger and reducing food waste' },
  { avatar: '👨‍💼', name: 'Ravindu Tharusha',       role: 'Operations Director', bio: 'Ensuring smooth coordination between donors and recipients' },
  { avatar: '👨‍💻', name: 'Inuka Kavinda',           role: 'Tech Lead',           bio: 'Building the technology platform that powers our mission' },
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

        {/* Mission */}
        <section id="mission" className="about-section">
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
        </section>

        {/* Vision */}
        <section className="about-section">
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
        </section>

        {/* Impact stats */}
        <section className="about-section">
          <h2 className="about-section-title">Our Impact</h2>
          <div className="about-stats">
            {STATS.map(s => (
              <div key={s.label} className="about-stat card">
                <span className="about-stat__value">{s.value}</span>
                <span className="about-stat__label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Why it matters */}
        <section className="about-section">
          <h2 className="about-section-title">Why This Matters</h2>
          <div className="about-cards">
            {WHY.map(w => (
              <div key={w.title} className="about-card card">
                <span className="about-card__icon">{w.icon}</span>
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="about-section">
          <h2 className="about-section-title">How It Works</h2>
          <div className="about-steps">
            {HOW.map(h => (
              <div key={h.num} className="about-step">
                <div className="about-step__num">{h.num}</div>
                <div className="about-step__body">
                  <h3>{h.title}</h3>
                  <p>{h.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section className="about-section">
          <h2 className="about-section-title">Meet Our Team</h2>
          <div className="about-team">
            {TEAM.map(m => (
              <div key={m.name} className="about-team-member card">
                <div className="about-team-member__avatar">{m.avatar}</div>
                <h3>{m.name}</h3>
                <p className="about-team-member__role">{m.role}</p>
                <p className="about-team-member__bio">{m.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
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

        {/* Contact strip */}
        <section className="about-section">
          <h2 className="about-section-title">Get In Touch</h2>
          <div className="about-contact">
            <div className="about-contact__items">
              {[
                { icon: '📧', label: 'Email',   value: 'info@sharingexcess.lk' },
                { icon: '📞', label: 'Phone',   value: '+94 77 123 4567' },
                { icon: '📍', label: 'Address', value: 'Uva Wellassa University, Badulla, Sri Lanka' },
              ].map(c => (
                <div key={c.label} className="about-contact-item">
                  <span className="about-contact-item__icon">{c.icon}</span>
                  <div>
                    <strong>{c.label}</strong>
                    <p>{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="about-social">
              <h4>Follow Us</h4>
              <div className="about-social__links">
                {['📘', '🐦', '📷', '💼'].map((icon, i) => (
                  <span key={i} className="about-social__link">{icon}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
