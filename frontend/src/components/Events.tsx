import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { emailSchema } from '../lib/schemas';
import { useEvents, useJoinEvent, useMeta, usePublicStats, useReport, useSubscribeToEvents } from '../hooks/queries';
import type { CommunityEvent } from '../types/api';
import { EVENT_ICON, fmtDate, fmtTime, imgSrc } from '../utils/format';
import Toast, { type ToastState } from './Toast';
import { Avatar, DistrictSelect, ReasonModal } from './ui';

/** Event times are Sri Lanka wall-clock strings with no zone: show them exactly as stored. */
function when(ev: CommunityEvent) {
  const time = ev.ends_at ? `${fmtTime(ev.starts_at)} – ${fmtTime(ev.ends_at)}` : fmtTime(ev.starts_at);
  return { date: fmtDate(ev.starts_at), time };
}

export default function Events() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const [type, setType] = useState('');
  const [district, setDistrict] = useState('');
  const { data, isPending, isError, refetch } = useEvents({ event_type: type, district });
  const { data: stats } = usePublicStats();
  const join = useJoinEvent();
  const subscribe = useSubscribeToEvents();
  const report = useReport();

  const [toast, setToast] = useState<ToastState | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyError, setNotifyError] = useState('');
  const [notified, setNotified] = useState(false);
  const [reporting, setReporting] = useState<CommunityEvent | null>(null);

  const events = data?.events ?? [];
  const upcoming = events.filter((e) => !e.is_past && e.status === 'published');
  const cancelled = events.filter((e) => !e.is_past && e.status === 'cancelled');
  const past = events.filter((e) => e.is_past).reverse();
  const canJoin = (ev: CommunityEvent) => user?.role !== 'admin' && ev.owner_id !== user?.id;

  const onJoin = (ev: CommunityEvent) => {
    if (!user) { window.dispatchEvent(new Event('openLogin')); return; }
    join.mutate({ id: ev.id, join: !ev.joined }, {
      onSuccess: (res) => setToast({ msg: res.message }),
      onError: (err) => setToast({ msg: err.message, type: 'error' }),
    });
  };

  const onSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(notifyEmail);
    if (!parsed.success) { setNotifyError(parsed.error.issues[0].message); return; }
    setNotifyError('');
    subscribe.mutate(parsed.data, { onSuccess: () => setNotified(true), onError: (err) => setNotifyError(err.message) });
  };

  const next = upcoming[0];
  const filtered = !!(type || district);

  return (
    <div className="events-page">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}

      <div className="events-hero">
        <div className="container">
          <h1 className="events-hero__title">{t('events', 'title')}</h1>
          <p className="events-hero__sub">{t('events', 'subtitle')}</p>
          <div className="events-hero__stats">
            <div className="events-hero__stat"><span>{stats?.events_upcoming ?? upcoming.length}</span>{t('events', 'upcoming_count')}</div>
            <div className="events-hero__stat"><span>{(stats?.ngos ?? 0).toLocaleString()}</span>{t('events', 'ngos_count')}</div>
            <div className="events-hero__stat"><span>{(stats?.handovers_completed ?? 0).toLocaleString()}</span>{t('events', 'handovers')}</div>
          </div>
        </div>
        <div className="events-hero__wave" aria-hidden="true">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0,30 C480,70 960,0 1440,40 L1440,60 L0,60 Z" fill="var(--bg-base)" />
          </svg>
        </div>
      </div>

      <div className="container events-body">
        <div className="events-filters">
          <div className="se-catbar" role="group" aria-label={t('events', 'type')}>
            <button className={`se-catchip${type === '' ? ' on' : ''}`} onClick={() => setType('')}>✨ {t('food', 'all')}</button>
            {(meta?.event_types ?? []).map((k) => (
              <button key={k} className={`se-catchip${type === k ? ' on' : ''}`} onClick={() => setType(type === k ? '' : k)}>{EVENT_ICON[k]} {t('etype', k)}</button>
            ))}
          </div>
          <div className="events-filters__district">
            <DistrictSelect value={district} onChange={setDistrict} allLabel={t('food', 'all_districts')} />
            {filtered && <button className="btn btn-outline btn-sm" onClick={() => { setType(''); setDistrict(''); }}>✕ {t('ui', 'clear')}</button>}
          </div>
        </div>

        <div className="events-layout">
          <div className="events-main">
            <section className="events-section">
              <h2 className="events-section-title">{t('events', 'upcoming')}</h2>
              {isPending ? (
                <div className="events-empty"><span>⏳</span><p>…</p></div>
              ) : isError ? (
                <div className="events-empty"><span>⚠️</span><p>{t('ui', 'load_failed')}</p>
                  <button className="btn btn-primary btn-sm" onClick={() => refetch()}>{t('ui', 'try_again')}</button></div>
              ) : upcoming.length === 0 ? (
                <div className="events-empty"><span>📅</span><p>{filtered ? t('events', 'no_match') : t('events', 'no_events')}</p>
                  <p className="events-empty__hint">{t('events', 'empty_hint')}</p></div>
              ) : (
                <div className="events-grid">
                  {upcoming.map((ev) => (
                    <EventCard key={ev.id} ev={ev} canJoin={canJoin(ev)} busy={join.isPending} onJoin={() => onJoin(ev)}
                      onReport={user ? () => setReporting(ev) : undefined} />
                  ))}
                </div>
              )}
            </section>

            {cancelled.length > 0 && (
              <section className="events-section">
                <h2 className="events-section-title">{t('events', 'cancelled')}</h2>
                <div className="events-grid">{cancelled.map((ev) => <EventCard key={ev.id} ev={ev} canJoin={false} busy={false} onJoin={() => {}} />)}</div>
              </section>
            )}

            {past.length > 0 && (
              <section className="events-section">
                <h2 className="events-section-title">{t('events', 'past')}</h2>
                <div className="events-grid">{past.map((ev) => <EventCard key={ev.id} ev={ev} canJoin={false} busy={false} onJoin={() => {}} />)}</div>
              </section>
            )}
          </div>

          <aside className="events-sidebar">
            <div className="events-notify card">
              <div className="events-notify__icon">🔔</div>
              <h3>{t('events', 'stay_title')}</h3>
              <p>{user ? t('events', 'stay_user') : t('events', 'stay_guest')}</p>
              {user ? (
                <Link to="/account#notifications" className="btn btn-primary btn-block">{t('dash', 'alert_prefs')}</Link>
              ) : notified ? (
                <p className="events-notify__done">✅ {t('events', 'on_list')}</p>
              ) : (
                <form className="events-notify__form" onSubmit={onSubscribe} noValidate>
                  <input className="form-control" type="email" autoComplete="email" value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)} placeholder={t('events', 'email_ph')}
                    aria-label={t('events', 'email_label')} aria-invalid={!!notifyError} />
                  {notifyError && <p className="form-error" role="alert">{notifyError}</p>}
                  <button type="submit" className="btn btn-primary btn-block" disabled={subscribe.isPending}>
                    {subscribe.isPending ? '…' : t('events', 'notify_me')}
                  </button>
                </form>
              )}
            </div>

            <div className="events-howto card">
              <h3 className="events-howto__title">{t('events', 'howto')}</h3>
              <ol className="events-howto__list">
                <li><span>1</span> {t('events', 'howto1')}</li>
                <li><span>2</span> {t('events', 'howto2')}</li>
                <li><span>3</span> {t('events', 'howto3')}</li>
              </ol>
              {user?.role === 'ngo' && <Link to="/ngo-dashboard" className="btn btn-outline btn-sm">{t('events', 'manage')}</Link>}
              {!user && <Link to="/ngos" className="btn btn-outline btn-sm">🤝 {t('nav', 'ngos')}</Link>}
            </div>

            {next && (
              <div className="events-next card">
                <div className="events-next__label">{t('events', 'next')}</div>
                <h4 className="events-next__title">{next.title}</h4>
                <p className="events-next__date">📅 {when(next).date}</p>
                <p className="events-next__loc">📍 {next.location}, {next.district}</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {reporting && (
        <ReasonModal title={t('food', 'report_title')} label={t('food', 'report_label')} confirmLabel={t('food', 'report')} required danger
          busy={report.isPending} onClose={() => setReporting(null)}
          onConfirm={async (reason) => {
            try { const res = await report.mutateAsync({ target_type: 'event', target_id: reporting.id, reason }); setToast({ msg: res.message }); setReporting(null); }
            catch (err) { setToast({ msg: (err as Error).message, type: 'error' }); }
          }} />
      )}
    </div>
  );
}

function EventCard({ ev, canJoin, busy, onJoin, onReport }: {
  ev: CommunityEvent; canJoin: boolean; busy: boolean; onJoin: () => void; onReport?: () => void;
}) {
  const { t } = useLanguage();
  const { date, time } = when(ev);
  const cancelled = ev.status === 'cancelled';
  const spots = ev.capacity === null ? `${ev.going} ${t('events', 'joined')}` : ev.full ? t('events', 'full') : `${ev.spots_left} ${t('events', 'spots_left')}`;
  return (
    <div className={`event-card card${ev.is_past || cancelled ? ' event-card--past' : ''}`}>
      {ev.images[0] && <img className="event-card__img" src={imgSrc(ev.images[0])} alt="" loading="lazy" />}
      <div className="event-card__header">
        <span className="badge badge-blue">{EVENT_ICON[ev.event_type]} {t('etype', ev.event_type)}</span>
        {cancelled ? <span className="badge badge-red">{t('events', 'cancelled')}</span>
          : <span className={`badge ${ev.full && !ev.is_past ? 'badge-red' : 'badge-amber'}`}>{ev.is_past ? `${ev.going} ${t('events', 'took_part')}` : spots}</span>}
      </div>
      <h3 className="event-card__title">{ev.title}</h3>
      <ul className="event-card__meta">
        <li>📅 {date}</li>
        <li>🕐 {time}</li>
        <li>📍 {ev.location}, {ev.district}</li>
        {ev.organiser && <li><Avatar size={24} src={ev.organiser.logo} name={ev.organiser.name} /> {ev.organiser.name}</li>}
      </ul>
      {ev.description && <p className="event-card__desc">{ev.description}</p>}
      {(ev.contact.phone || ev.contact.email) && (
        <p className="event-card__contact">☎️ {ev.contact.name}{ev.contact.phone ? ` · ${ev.contact.phone}` : ''}{ev.contact.email ? ` · ${ev.contact.email}` : ''}</p>
      )}
      <div className="event-card__actions">
        {!ev.is_past && !cancelled && canJoin && (
          <button className={`btn btn-sm ${ev.joined ? 'btn-outline' : 'btn-primary'}`} disabled={busy || (ev.full && !ev.joined)} onClick={onJoin}>
            {ev.joined ? `✓ ${t('events', 'joined_leave')}` : ev.full ? t('events', 'event_full') : t('events', 'join')}
          </button>
        )}
        {onReport && <button type="button" className="ld-report" onClick={onReport}>🚩 {t('food', 'report')}</button>}
      </div>
    </div>
  );
}
