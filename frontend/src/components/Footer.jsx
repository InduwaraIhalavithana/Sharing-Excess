import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import './Footer.css';

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  const quickLinks = [
    { to: '/',         label: t('nav', 'home') },
    { to: '/about',    label: t('nav', 'about') },
    { to: '/ngos',     label: t('nav', 'ngos') },
    { to: '/food',     label: t('nav', 'food') },
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
                <span>Uva Wellassa University, Badulla, Sri Lanka</span>
              </li>
              <li>
                <span className="se-footer__contact-icon">✉️</span>
                <a href="mailto:info@sharingexcess.lk" className="se-footer__link">info@sharingexcess.lk</a>
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
            <Link to="/privacy" className="se-footer__link">{t('footer', 'privacy')}</Link>
            <span className="se-footer__sep">·</span>
            <Link to="/terms" className="se-footer__link">{t('footer', 'terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
