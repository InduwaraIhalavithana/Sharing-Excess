import { useState, useEffect, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useAuth } from '../contexts/AuthContext.jsx';
import { API_BASE } from '../config.js';

function Toast({ msg, type = 'success', onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3200);
    return () => clearTimeout(id);
  }, [onDone]);
  return <div className={`dd-toast dd-toast--${type}`}>{msg}</div>;
}

const STATUS_LABELS = {
  pending:         'Pending',
  quality_checked: 'Quality Checked',
  delivering:      'Delivering',
  delivered:       'Delivered',
  cancelled:       'Cancelled',
};

const STATUS_BADGE = {
  pending:         'badge badge-amber',
  quality_checked: 'badge badge-blue',
  delivering:      'badge badge-amber',
  delivered:       'badge badge-green',
  cancelled:       'badge badge-red',
};

export default function CalendarPage() {
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const { user } = useAuth();

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/calendar/events`);
      const data = await res.json();
      if (data.success && data.events) {
        setEvents(data.events.map(e => ({ ...e, start: new Date(e.date), end: new Date(e.date) })));
      }
    } catch {
      showToast('Failed to load events.', 'error');
    }
    setLoading(false);
  }, [showToast]);

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

  const handleStatusUpdate = async (eventId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/requests/${eventId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: eventId, status: newStatus }),
      });
      const result = await res.json();
      if (result.success) {
        showToast('Status updated.');
        fetchEvents();
      } else {
        showToast(result.message || 'Update failed.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }
  };

  const isOfficer = ['admin', 'officer'].includes(String(user?.role || '').toLowerCase());

  return (
    <div className="calendar-page">
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <h2 className="calendar-page__title">Food Donation Calendar</h2>

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
            Events for {date.toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h3>

          {loading ? (
            <div className="dd-loading"><span className="dd-spinner" /> Loading…</div>
          ) : selectedEvents.length === 0 ? (
            <div className="dd-empty">
              <span className="dd-empty__icon">📅</span>
              <p>No events for this date. Select another date.</p>
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
                    <span className={STATUS_BADGE[ev.status] || 'badge badge-gray'}>
                      {STATUS_LABELS[ev.status] || ev.status}
                    </span>
                  </div>
                  <div className="calendar-event-card__meta">
                    {ev.location && <span>📍 {ev.location}</span>}
                    {ev.donor?.name && <span>👤 Donor: {ev.donor.name}</span>}
                    {ev.recipient?.name && <span>🤝 Recipient: {ev.recipient.name}</span>}
                    {ev.date && <span>📅 {new Date(ev.date).toLocaleDateString()}</span>}
                  </div>

                  {/* Officer status controls */}
                  {isOfficer && ev.type === 'request' && (
                    <div className="calendar-status-btns">
                      {['quality_checked', 'delivering', 'delivered'].map(s => (
                        <button
                          key={s}
                          className={`btn btn-sm${ev.status === s ? ' btn-primary' : ' btn-outline'}`}
                          disabled={ev.status === 'delivered' || ev.status === 'cancelled'}
                          onClick={() => handleStatusUpdate(String(ev.id).replace('req_', ''), s)}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
