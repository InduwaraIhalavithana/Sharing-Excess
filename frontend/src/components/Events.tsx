import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { emailSchema } from '../lib/schemas';
import { useEvents, useJoinEvent, usePublicStats, useSubscribeToEvents } from '../hooks/queries';
import type { CommunityEvent } from '../types/api';
import Toast, { type ToastState } from './Toast';

const dateFmt = new Intl.DateTimeFormat('en-LK', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-LK', { hour: 'numeric', minute: '2-digit' });

/** Event times are Sri Lanka wall-clock strings with no zone: show them exactly as stored. */
function when(ev: CommunityEvent) {
  const start = new Date(ev.starts_at);
  const time = ev.ends_at ? `${timeFmt.format(start)} – ${timeFmt.format(new Date(ev.ends_at))}` : timeFmt.format(start);
  return { date: dateFmt.format(start), time };
}

function spotsLabel(ev: CommunityEvent) {
  if (ev.capacity === null) return `${ev.going} joined`;
  if (ev.full) return 'Full';
  return `${ev.spots_left} spot${ev.spots_left === 1 ? '' : 's'} left`;
}

export default function Events() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, isPending, isError, refetch } = useEvents();
  const { data: stats } = usePublicStats();
  const join = useJoinEvent();
  const subscribe = useSubscribeToEvents();

  const [toast, setToast] = useState<ToastState | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyError, setNotifyError] = useState('');
  const [notified, setNotified] = useState(false);

  const events = data?.events ?? [];
  const upcoming = events.filter((e) => !e.is_past);
  const past = events.filter((e) => e.is_past).reverse();
  const isStaff = user?.role === 'adminofficer';

  const onJoin = (ev: CommunityEvent) => {
    if (!user) {
      window.dispatchEvent(new Event('openLogin'));
      return;
    }
    join.mutate(
      { id: ev.id, join: !ev.joined },
      {
        onSuccess: (res) => setToast({ msg: res.message }),
        onError: (err) => setToast({ msg: err.message, type: 'error' }),
      },
    );
  };

  const onSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(notifyEmail);
    if (!parsed.success) {
      setNotifyError(parsed.error.issues[0].message);
      return;
    }
    setNotifyError('');
    subscribe.mutate(parsed.data, {
      onSuccess: () => setNotified(true),
      onError: (err) => setNotifyError(err.message),
    });
  };

  const next = upcoming[0];

  return (
    <div className="events-page">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}

      <div className="events-hero">
        <div className="container">
          <h1 className="events-hero__title">{t('events', 'title')}</h1>
          <p className="events-hero__sub">{t('events', 'subtitle')}</p>
          <div className="events-hero__stats">
            <div className="events-hero__stat"><span>{upcoming.length}</span>Upcoming Events</div>
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
          <div className="events-main">
            <section className="events-section">
              <h2 className="events-section-title">{t('events', 'upcoming')}</h2>
              {isPending ? (
                <div className="events-empty"><span>⏳</span><p>Loading events…</p></div>
              ) : isError ? (
                <div className="events-empty">
                  <span>⚠️</span>
                  <p>We couldn't load the events.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => refetch()}>Try again</button>
                </div>
              ) : upcoming.length === 0 ? (
                <div className="events-empty">
                  <span>📅</span>
                  <p>{t('events', 'no_events')}</p>
                  <p className="events-empty__hint">Leave your email on the right and we'll tell you when the next one is announced.</p>
                </div>
              ) : (
                <div className="events-grid">
                  {upcoming.map((ev) => (
                    <EventCard key={ev.id} ev={ev} canJoin={!isStaff} busy={join.isPending} onJoin={() => onJoin(ev)} />
                  ))}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section className="events-section">
                <h2 className="events-section-title">{t('events', 'past')}</h2>
                <div className="events-grid">
                  {past.map((ev) => <EventCard key={ev.id} ev={ev} canJoin={false} busy={false} onJoin={() => {}} />)}
                </div>
              </section>
            )}
          </div>

          <aside className="events-sidebar">
            <div className="events-notify card">
              <div className="events-notify__icon">🔔</div>
              <h3>Stay in the Loop</h3>
              <p>Get an email when a new food drive or volunteer session is announced.</p>
              {notified ? (
                <p className="events-notify__done">✅ You're on the list!</p>
              ) : (
                <form className="events-notify__form" onSubmit={onSubscribe} noValidate>
                  <input
                    className="form-control"
                    type="email"
                    autoComplete="email"
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)}
                    placeholder="Enter your email"
                    aria-label="Email address"
                    aria-invalid={!!notifyError}
                  />
                  {notifyError && <p className="form-error" role="alert">{notifyError}</p>}
                  <button type="submit" className="btn btn-primary btn-block" disabled={subscribe.isPending}>
                    {subscribe.isPending ? 'Saving…' : 'Notify Me'}
                  </button>
                </form>
              )}
            </div>

            <div className="events-howto card">
              <h3 className="events-howto__title">How to Participate</h3>
              <ol className="events-howto__list">
                <li><span>1</span> Sign in, then press "Join Event" on any upcoming event</li>
                <li><span>2</span> Bring surplus food or volunteer your time</li>
                <li><span>3</span> Our team coordinates pickup &amp; delivery</li>
                <li><span>4</span> Track your impact on your dashboard</li>
              </ol>
              {isStaff && <Link to="/admin" className="btn btn-outline btn-sm">Manage events in the admin panel</Link>}
            </div>

            {next && (
              <div className="events-next card">
                <div className="events-next__label">Next Event</div>
                <h4 className="events-next__title">{next.title}</h4>
                <p className="events-next__date">📅 {when(next).date}</p>
                <p className="events-next__loc">📍 {next.location}</p>
                <span className="badge badge-amber" style={{ marginTop: 8, display: 'inline-block' }}>{spotsLabel(next)}</span>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function EventCard({ ev, canJoin, busy, onJoin }: { ev: CommunityEvent; canJoin: boolean; busy: boolean; onJoin: () => void }) {
  const { date, time } = when(ev);
  return (
    <div className={`event-card card${ev.is_past ? ' event-card--past' : ''}`}>
      <div className="event-card__header">
        <span className={`badge ${ev.is_past ? 'badge-gray' : 'badge-green'}`}>{ev.is_past ? 'Past Event' : 'Upcoming'}</span>
        <span className={`badge ${ev.full && !ev.is_past ? 'badge-red' : 'badge-amber'}`}>
          {ev.is_past ? `${ev.going} took part` : spotsLabel(ev)}
        </span>
      </div>
      <h3 className="event-card__title">{ev.title}</h3>
      <ul className="event-card__meta">
        <li>📅 {date}</li>
        <li>🕐 {time}</li>
        <li>📍 {ev.location}</li>
      </ul>
      {ev.description && <p className="event-card__desc">{ev.description}</p>}
      {!ev.is_past && canJoin && (
        <button
          className={`btn btn-sm ${ev.joined ? 'btn-outline' : 'btn-primary'}`}
          disabled={busy || (ev.full && !ev.joined)}
          onClick={onJoin}
        >
          {ev.joined ? '✓ Joined - leave' : ev.full ? 'Event full' : 'Join Event'}
        </button>
      )}
    </div>
  );
}
