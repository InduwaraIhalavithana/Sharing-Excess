import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import './Footer.css';

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  const quickLinks = [
    { to: '/',         label: t('nav', 'home') },
    { to: '/about',    label: t('nav', 'about') },
    { to: '/ngos',     label: t('nav', 'ngos') },
    { to: '/donate',   label: t('nav', 'donate') },
    { to: '/events',   label: t('nav', 'events') },
    { to: '/feedback', label: t('nav', 'feedback') },
  ];

  return (
    <footer className="se-footer" role="contentinfo">
      <div className="se-footer__inner">
        <div className="se-footer__grid">
          {/* Brand column */}
          <div className="se-footer__col se-footer__col--brand">
            <Link to="/" className="se-footer__brand">
              <span className="se-footer__brand-icon">🌿</span>
              <span className="se-footer__brand-text">
                <span>Sharing</span><span className="brand-accent"> Excess</span>
              </span>
            </Link>
            <p className="se-footer__tagline">{t('footer', 'tagline')}</p>
            <div className="se-footer__social">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="se-footer__social-link">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="se-footer__social-link">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="se-footer__social-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="se-footer__col">
            <h4 className="se-footer__col-title">{t('footer', 'links_title')}</h4>
            <ul className="se-footer__links">
              {quickLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="se-footer__link">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="se-footer__col">
            <h4 className="se-footer__col-title">{t('footer', 'contact_title')}</h4>
            <ul className="se-footer__contact-list">
              <li>
                <span className="se-footer__contact-icon">📍</span>
                <span>Colombo, Sri Lanka</span>
              </li>
              <li>
                <span className="se-footer__contact-icon">✉️</span>
                <a href="mailto:hello@sharingexcess.lk" className="se-footer__link">hello@sharingexcess.lk</a>
              </li>
              <li>
                <span className="se-footer__contact-icon">📞</span>
                <a href="tel:+94112345678" className="se-footer__link">+94 11 234 5678</a>
              </li>
              <li>
                <span className="se-footer__contact-icon">🕐</span>
                <span>{t('contact', 'hours_value')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="se-footer__bottom">
          <p className="se-footer__copyright">
            {t('footer', 'copyright').replace('2025', String(year))}
          </p>
          <div className="se-footer__legal">
            <a href="#" className="se-footer__link">{t('footer', 'privacy')}</a>
            <span className="se-footer__sep">·</span>
            <a href="#" className="se-footer__link">{t('footer', 'terms')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
