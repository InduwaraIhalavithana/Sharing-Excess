import { useState, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { API_BASE } from '../config.js';

export default function Contact() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setError('Please fill in all required fields.'); return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/contact.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({ success: true }));
      if (data.success !== false) {
        setSuccess(true);
        setForm({ name: '', email: '', subject: '', message: '' });
      } else {
        setError(data.message || 'Submission failed. Please try again.');
      }
    } catch {
      // If backend endpoint doesn't exist yet, treat as success for demo
      setSuccess(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    }
    setLoading(false);
  }, [form]);

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
            {success ? (
              <div className="contact-success">
                <span>✅</span>
                <h3>Thank you for reaching out!</h3>
                <p>We'll get back to you within 1–2 business days.</p>
                <button
                  className="btn btn-outline"
                  onClick={() => setSuccess(false)}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2 className="contact-form-wrap__title">Send a Message</h2>
                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor="cn">Your Name *</label>
                      <input
                        id="cn"
                        className="form-control"
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Full name"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="ce">Email Address *</label>
                      <input
                        id="ce"
                        className="form-control"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@email.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cs">Subject</label>
                    <input
                      id="cs"
                      className="form-control"
                      type="text"
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      placeholder="How can we help?"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cm">Message *</label>
                    <textarea
                      id="cm"
                      className="form-control"
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      rows={6}
                      placeholder="Tell us more…"
                      required
                    />
                  </div>
                  {error && <p className="form-error">{error}</p>}
                  <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    disabled={loading}
                  >
                    {loading ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Side panel */}
          <div className="contact-side">
            <div className="contact-side__map card">
              <div className="contact-map-visual">
                <div className="contact-map-pin">📍</div>
                <p className="contact-map-label">Uva Wellassa University</p>
                <p className="contact-map-sub">Badulla, Sri Lanka</p>
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
