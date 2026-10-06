import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useEvents, useRatingSummary } from '../hooks/queries';
import { fmtDate, fmtDateTime } from '../utils/format';
import { Empty, Stars } from './ui';

/** What anyone can see about a donor, recipient or NGO: their name, their rating and what people wrote. No contact details. */
export default function PublicProfile() {
  const { id } = useParams();
  const userId = Number(id);
  const { t } = useLanguage();
  const { data, isPending, isError } = useRatingSummary(Number.isFinite(userId) ? userId : undefined);
  const isNgo = data?.user.role === 'ngo';
  const events = useEvents(isNgo ? { owner_id: userId } : { owner_id: -1 });

  if (isPending) return <div className="container" style={{ padding: 40 }}>…</div>;
  if (isError || !data) {
    return <div className="container" style={{ padding: 40 }}><Empty icon="🔎" action={<Link to="/" className="btn btn-primary btn-sm">{t('nav', 'home')}</Link>}>{t('profile', 'not_found')}</Empty></div>;
  }

  const upcoming = (events.data?.events ?? []).filter((e) => !e.is_past && e.status === 'published');
  return (
    <div className="container ld-page">
      <div className="dashboard-card pp-card">
        <div className="pp-avatar" aria-hidden="true">{data.user.name.charAt(0).toUpperCase()}</div>
        <div>
          <h1>{data.user.name}</h1>
          <p className="dd-card-meta">{t('role', data.user.role)}</p>
          {data.average !== null ? <Stars value={data.average} count={data.count} /> : <p className="dd-card-meta">{t('profile', 'no_ratings')}</p>}
        </div>
      </div>

      {data.recent.length > 0 && (
        <section>
          <h2 className="events-section-title">{t('profile', 'what_people_say')}</h2>
          <div className="pp-reviews">
            {data.recent.map((r, i) => (
              <blockquote key={i} className="dashboard-card pp-review">
                <Stars value={r.score} />
                <p>“{r.comment}”</p>
                <footer>— {r.from}{r.created_at ? ` · ${fmtDateTime(r.created_at)}` : ''}</footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {isNgo && upcoming.length > 0 && (
        <section>
          <h2 className="events-section-title">{t('ngos', 'upcoming')}</h2>
          <ul className="pp-events">
            {upcoming.map((e) => <li key={e.id}><Link to="/events">📅 <b>{e.title}</b></Link> · {fmtDate(e.starts_at)} · {e.district}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
