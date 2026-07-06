import { useLanguage } from '../i18n/LanguageContext.jsx';
import './NGOs.css';

const PARTNERS = [
  { id: 1,  name: 'Ceylon Biscuits Limited (CBL)', logo: '/cbl.jpg',                impact: '1M+ nutrition packs distributed',  desc: 'Leading food manufacturer supporting community nutrition programs and disaster relief across Sri Lanka.', url: 'https://www.cbl.lk/' },
  { id: 2,  name: 'Dilmah Tea',                    logo: '/dilmah.jpg',             impact: '10,000+ farmers supported',         desc: 'Promoting sustainable agriculture, rural development, and ethical tea production.', url: 'https://www.dilmahtea.com/' },
  { id: 3,  name: 'MAS Holdings',                  logo: '/mas.jpg',                impact: '5,000+ scholarships awarded',       desc: 'Empowering women and supporting local communities through apparel manufacturing and education.', url: 'https://www.masholdings.com/' },
  { id: 4,  name: 'Brandix',                       logo: '/brandix.png',            impact: '100+ schools supported',            desc: 'Driving sustainability and education initiatives including water conservation and school programs.', url: 'https://www.brandix.com/' },
  { id: 5,  name: 'Red Bull',                      logo: '/redbull.jpg',            impact: '50+ community events sponsored',    desc: 'Supporting youth empowerment, sports, and community events across Sri Lanka.', url: 'https://www.redbull.com/lk-en/' },
  { id: 6,  name: 'John Keells Holdings',          logo: '/johnkeellsholdings.jpg', impact: '200+ community projects',           desc: "Investing in health, education, and environmental projects through the John Keells Foundation.", url: 'https://www.keells.com/' },
  { id: 7,  name: 'Hemas Holdings',               logo: '/hemas.jpg',              impact: '30+ health clinics established',    desc: 'Supporting healthcare and community well-being with a focus on maternal and child health.', url: 'https://www.hemas.com/' },
  { id: 8,  name: 'Hayleys',                       logo: '/hayleys.jpg',            impact: '1M+ trees planted',                 desc: 'Championing environmental and social responsibility including reforestation and clean water.', url: 'https://www.hayleys.com/' },
  { id: 9,  name: 'Dialog Axiata',                 logo: '/dialog.jpg',             impact: '1,000+ schools connected',          desc: 'Driving digital inclusion and educational programs, providing free internet to 1,000+ schools.', url: 'https://www.dialog.lk/' },
  { id: 10, name: 'Commercial Bank of Ceylon',     logo: '/commercial.jpg',         impact: '20,000+ micro-loans granted',       desc: 'Supporting entrepreneurship and financial literacy with micro-loans to small businesses.', url: 'https://www.combank.lk/' },
];

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
        <h2 className="ngos-section-title">Our Cooperations</h2>
        <div className="ngos-grid">
          {PARTNERS.map(p => (
            <div key={p.id} className="ngos-card card">
              <div className="ngos-card__logo-wrap">
                <img
                  src={p.logo}
                  alt={p.name}
                  className="ngos-card__logo"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </div>
              <div className="ngos-card__body">
                <h3 className="ngos-card__name">{p.name}</h3>
                <span className="ngos-card__impact badge badge-green">{p.impact}</span>
                <p className="ngos-card__desc">{p.desc}</p>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  Visit Website ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
