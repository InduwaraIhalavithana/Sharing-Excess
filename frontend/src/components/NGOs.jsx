import { useLanguage } from '../i18n/LanguageContext';
import './NGOs.css';
import { SAMPLE_PARTNERS } from '../data/samplePartners';
import { Link } from 'react-router-dom';

export default function NGOs() {
  const { t } = useLanguage();

  return (
    <div className="ngos-page">
      {/* Hero */}
      <div className="ngos-hero">
        <div className="ngos-hero__content container">
          <h1 className="ngos-hero__title">{t('ngos', 'title')}</h1>
          <p className="ngos-hero__sub">{t('ngos', 'subtitle')}</p>
          <a href="/contact" className="btn btn-primary">Reach Out to the Team</a>
        </div>
      </div>

      {/* Partners grid */}
      <div className="container ngos-body">
        <p className="ngos-sample-banner" role="note">
          ℹ️ <strong>Sample organisations.</strong> These are invented examples that show how partner NGOs will appear.
          They are not real organisations and none of them has endorsed Sharing Excess.
        </p>
        <h2 className="ngos-section-title">Partner organisations</h2>
        <div className="ngos-grid">
          {SAMPLE_PARTNERS.map(p => (
            <div key={p.id} className="ngos-card card">
              <div className="ngos-card__logo-wrap ngos-card__icon" aria-hidden="true">{p.icon}</div>
              <div className="ngos-card__body">
                <h3 className="ngos-card__name">{p.name}</h3>
                <span className="ngos-card__impact badge badge-green">{p.kind} · {p.district}</span>
                <p className="ngos-card__desc">{p.description}</p>
                <span className="badge badge-gray">Sample</span>
              </div>
            </div>
          ))}
        </div>

        <div className="ngos-join card">
          <h2>🤝 Run a charity, kitchen or food bank?</h2>
          <p>Register as a recipient to request food, or get in touch to become a listed partner organisation.</p>
          <Link to="/contact" className="btn btn-primary">Become a partner</Link>
        </div>
      </div>
    </div>
  );
}
