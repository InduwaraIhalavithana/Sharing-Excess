import { useState, useEffect, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config';
import Toast from './Toast';
import { StatusBadge } from './ui';
import { useLanguage } from '../i18n/LanguageContext';
import { apiFetch } from '../utils/api';

export default function CalendarPage() {
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const { user } = useAuth();
  const { t } = useLanguage();

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  const fetchEvents = useCallback(async () => {
    if (!user) { setEvents([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/calendar/events`);
      const data = await res.json();
      if (data.success && data.events) {
        setEvents(data.events.map(e => ({ ...e, start: new Date(e.date), end: new Date(e.date) })));
      }
    } catch {
      showToast('Failed to load events.', 'error');
    }
    setLoading(false);
  }, [showToast, user]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const localDate = `${y}-${m}-${d}`;
    setSelectedEvents(events.filter(e => e.date && e.date.split('T')[0] === localDate));
  }, [date, events]);

  const tileContent = ({ date: tDate, view }) => {
    if (view !== 'month') return null;
    const str = tDate.toISOString().split('T')[0];
    const has = events.some(e => e.date && e.date.split(' ')[0] === str);
    return has ? <div className="event-dot" /> : null;
  };



  return (
    <div className="calendar-page">
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <h2 className="calendar-page__title">{t('calendar', 'title')}</h2>

      <div className="calendar-layout">
        {/* Calendar widget */}
        <div>
          <Calendar
            onChange={setDate}
            value={date}
            tileContent={tileContent}
          />
        </div>

        {/* Events panel */}
        <div>
          <h3 className="calendar-events-title">
            {t('calendar', 'events_for')} {date.toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h3>

          {!user ? (
            <div className="dd-empty">
              <span className="dd-empty__icon">🔒</span>
              <p>{t('calendar', 'sign_in')}</p>
            </div>
          ) : loading ? (
            <div className="dd-loading"><span className="dd-spinner" /> Loading…</div>
          ) : selectedEvents.length === 0 ? (
            <div className="dd-empty">
              <span className="dd-empty__icon">📅</span>
              <p>{t('calendar', 'none')}</p>
            </div>
          ) : (
            <div style={{ maxHeight: 600, overflowY: 'auto', paddingRight: 4 }}>
              {selectedEvents.map(ev => (
                <div
                  key={ev.id}
                  className={`calendar-event-card${ev.type === 'listing' ? ' calendar-event-card--listing' : ''}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <p className="calendar-event-card__title">{ev.title} · {ev.quantity}</p>
                    <StatusBadge status={ev.status} />
                  </div>
                  <div className="calendar-event-card__meta">
                    {ev.location && <span>📍 {ev.location}</span>}
                    {ev.date && <span>⏰ {t('calendar', ev.type === 'listing' ? 'expires' : 'best_before')}: {new Date(ev.date).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
