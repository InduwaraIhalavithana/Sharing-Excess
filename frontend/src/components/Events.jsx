import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { usePublicStats } from '../hooks/queries';

const EVENTS = [
  {
    id: 1,
    title: 'Community Food Drive',
    date: '2026-08-15',
    time: '08:00 AM – 12:00 PM',
    location: 'Colombo City Centre',
    desc: 'Join our monthly food collection drive. Bring surplus packaged food to help stock the community pantry. All items donated go directly to verified recipient families.',
    status: 'upcoming',
    spots: '30 spots left',
  },
  {
    id: 2,
    title: 'Volunteer Orientation',
    date: '2026-08-22',
    time: '02:00 PM – 04:00 PM',
    location: 'Uva Wellassa University, Badulla',
    desc: 'New volunteer onboarding session. Learn how to register on the platform, co-ordinate pickups, and connect donors with NGO partners.',
    status: 'upcoming',
    spots: '15 spots left',
  },
  {
    id: 3,
    title: 'Food Distribution Drive',
    date: '2026-05-10',
    time: '10:00 AM – 02:00 PM',
    location: 'Gampaha District',
    desc: 'Volunteer-led distribution to underprivileged communities. Over 500 meals were distributed to families in need across 3 locations.',
    status: 'past',
    spots: 'Completed',
  },
];

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function Events() {
  const { data: stats } = usePublicStats();
  const { t } = useLanguage();
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySent, setNotifySent] = useState(false);

  const upcoming = EVENTS.filter(e => e.status === 'upcoming');
  const past     = EVENTS.filter(e => e.status === 'past');

  return (
    <div className="events-page">
      {/* Hero */}
      <div className="events-hero">
        <div className="container">
          <h1 className="events-hero__title">{t('events', 'title')}</h1>
          <p className="events-hero__sub">{t('events', 'subtitle')}</p>
          <div className="events-hero__stats">
            <div className="events-hero__stat"><span>{EVENTS.length}</span>Events Listed</div>
            <div className="events-hero__stat"><span>{(stats?.meals_delivered ?? 0).toLocaleString()}</span>Meals Delivered</div>
            <div className="events-hero__stat"><span>{(stats?.donors ?? 0).toLocaleString()}</span>Active Donors</div>
          </div>
        </div>
        <div className="events-hero__wave" aria-hidden="true">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0,30 C480,70 960,0 1440,40 L1440,60 L0,60 Z" fill="var(--bg-base)" />
          </svg>
        </div>
      </div>

      <div className="container events-body">
        <div className="events-layout">

          {/* Main content */}
          <div className="events-main">
            {/* Upcoming */}
            <section className="events-section">
              <h2 className="events-section-title">{t('events', 'upcoming')}</h2>
              {upcoming.length === 0 ? (
                <div className="events-empty">
                  <span>📅</span>
                  <p>{t('events', 'no_events')}</p>
                </div>
              ) : (
                <div className="events-grid">
                  {upcoming.map(ev => <EventCard key={ev.id} ev={ev} />)}
                </div>
              )}
            </section>

            {/* Past */}
            {past.length > 0 && (
              <section className="events-section">
                <h2 className="events-section-title">{t('events', 'past')}</h2>
                <div className="events-grid">
                  {past.map(ev => <EventCard key={ev.id} ev={ev} />)}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="events-sidebar">

            {/* Notify strip */}
            <div className="events-notify card">
              <div className="events-notify__icon">🔔</div>
              <h3>Stay in the Loop</h3>
              <p>Get notified about upcoming food drives and volunteer opportunities.</p>
              {notifySent ? (
                <p className="events-notify__done">✅ You're on the list!</p>
              ) : (
                <form
                  className="events-notify__form"
                  onSubmit={(e) => { e.preventDefault(); if (notifyEmail) setNotifySent(true); }}
                >
                  <input
                    className="form-control"
                    type="email"
                    value={notifyEmail}
                    onChange={e => setNotifyEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                  <button type="submit" className="btn btn-primary btn-block">Notify Me</button>
                </form>
              )}
            </div>

            {/* How to participate */}
            <div className="events-howto card">
              <h3 className="events-howto__title">How to Participate</h3>
              <ol className="events-howto__list">
                <li><span>1</span> Click "Join Event" on any upcoming event</li>
                <li><span>2</span> Bring surplus food or volunteer your time</li>
                <li><span>3</span> Our admins coordinate pickup & delivery</li>
                <li><span>4</span> Track your impact on your dashboard</li>
              </ol>
            </div>

            {/* Next event highlight */}
            {upcoming[0] && (
              <div className="events-next card">
                <div className="events-next__label">Next Event</div>
                <h4 className="events-next__title">{upcoming[0].title}</h4>
                <p className="events-next__date">📅 {fmt(upcoming[0].date)}</p>
                <p className="events-next__loc">📍 {upcoming[0].location}</p>
                <span className="badge badge-amber" style={{ marginTop: 8, display: 'inline-block' }}>{upcoming[0].spots}</span>
              </div>
            )}

          </aside>
        </div>
      </div>
    </div>
  );
}

function EventCard({ ev }) {
  return (
    <div className={`event-card card${ev.status === 'past' ? ' event-card--past' : ''}`}>
      <div className="event-card__header">
        <span className={`badge ${ev.status === 'upcoming' ? 'badge-green' : 'badge-gray'}`}>
          {ev.status === 'upcoming' ? 'Upcoming' : 'Past Event'}
        </span>
        {ev.spots !== 'Completed' && (
          <span className="badge badge-amber">{ev.spots}</span>
        )}
      </div>
      <h3 className="event-card__title">{ev.title}</h3>
      <ul className="event-card__meta">
        <li>📅 {fmt(ev.date)}</li>
        <li>🕐 {ev.time}</li>
        <li>📍 {ev.location}</li>
      </ul>
      <p className="event-card__desc">{ev.desc}</p>
      {ev.status === 'upcoming' && (
        <button className="btn btn-primary btn-sm">Join Event</button>
      )}
    </div>
  );
}
