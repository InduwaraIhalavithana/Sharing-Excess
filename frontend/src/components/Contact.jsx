import { useLanguage } from '../i18n/LanguageContext';
import ContactForm from './ContactForm';

export default function Contact() {
  const { t } = useLanguage();

  return (
    <div className="contact-page">
      {/* Hero */}
      <div className="contact-hero">
        <div className="container">
          <h1 className="contact-hero__title">{t('contact', 'title')}</h1>
          <p className="contact-hero__sub">{t('contact', 'subtitle')}</p>
        </div>
        <div className="contact-hero__wave" aria-hidden="true">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z" fill="var(--bg-base)" />
          </svg>
        </div>
      </div>

      <div className="container contact-body">

        {/* Info strips */}
        <div className="contact-info-strip">
          {[
            { icon: '📧', label: 'Email',   value: 'info@sharingexcess.lk', href: 'mailto:info@sharingexcess.lk' },
            { icon: '📞', label: 'Phone',   value: '+94 77 123 4567',        href: 'tel:+94771234567' },
            { icon: '📍', label: 'Address', value: 'Uva Wellassa University, Badulla, Sri Lanka', href: null },
            { icon: '🕑', label: 'Hours',   value: 'Mon – Fri, 9am – 5pm',  href: null },
          ].map(c => (
            <div key={c.label} className="contact-info-card card">
              <span className="contact-info-card__icon">{c.icon}</span>
              <strong>{c.label}</strong>
              {c.href
                ? <a href={c.href} className="contact-info-card__value">{c.value}</a>
                : <span className="contact-info-card__value">{c.value}</span>}
            </div>
          ))}
        </div>

        {/* Two-column: form + side panel */}
        <div className="contact-main-grid">

          {/* Form */}
          <div className="contact-form-wrap card">
            <ContactForm />
          </div>

          {/* Side panel */}
          <div className="contact-side">
            <div className="contact-side__map card">
              <iframe
                title="Uva Wellassa University, Badulla — map"
                className="contact-map-iframe"
                src="https://www.openstreetmap.org/export/embed.html?bbox=81.0500%2C6.9600%2C81.1050%2C7.0050&layer=mapnik&marker=6.9825%2C81.0765"
                loading="lazy"
              />
              <div className="contact-map-caption">
                <span>📍</span>
                <div>
                  <p className="contact-map-label">Uva Wellassa University</p>
                  <p className="contact-map-sub">Badulla, Sri Lanka</p>
                </div>
                <a
                  href="https://www.openstreetmap.org/?mlat=6.9825&mlon=81.0765#map=14/6.9825/81.0765"
                  target="_blank" rel="noopener noreferrer"
                  className="contact-map-open"
                >
                  Open map ↗
                </a>
              </div>
            </div>

            <div className="contact-side__faq card">
              <h3 className="contact-side__faq-title">Common Questions</h3>
              {[
                { q: 'How quickly do you respond?', a: 'We aim to reply within 1–2 business days.' },
                { q: 'Can I volunteer with you?', a: 'Yes! Mention it in your message and we\'ll send details.' },
                { q: 'How do I become an NGO partner?', a: 'Email us at info@sharingexcess.lk with your organisation details.' },
              ].map((faq, i) => (
                <div key={i} className="contact-faq-item">
                  <p className="contact-faq-item__q">❓ {faq.q}</p>
                  <p className="contact-faq-item__a">{faq.a}</p>
                </div>
              ))}
            </div>

            <div className="contact-side__social card">
              <h3 className="contact-side__social-title">Follow Us</h3>
              <div className="contact-social-links">
                {[
                  { icon: '📘', label: 'Facebook' },
                  { icon: '🐦', label: 'Twitter' },
                  { icon: '📷', label: 'Instagram' },
                  { icon: '💼', label: 'LinkedIn' },
                ].map(s => (
                  <div key={s.label} className="contact-social-link">
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
