import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useNotificationActions, useNotifications } from '../hooks/queries';
import { fmtDateTime } from '../utils/format';

const KIND_ICON: Record<string, string> = {
  new_listing: '🍽️', request_received: '📬', request_accepted: '✅', request_declined: '✕', request_cancelled: '↩️',
  request_no_show: '🚫', request_collected: '📦', request_completed: '🎉', request_expired: '⌛', rating_received: '⭐',
  new_event: '📅', ngo_approved: '🤝', ngo_rejected: '❌', listing_removed: '🗑️',
};

/** The bell in the navbar: unread count, the latest alerts, and a click takes you to what they are about. */
export default function NotificationBell() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data } = useNotifications(true);
  const { markRead, markAll } = useNotificationActions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const unread = data?.unread ?? 0;
  const items = data?.notifications ?? [];

  return (
    <div className="se-bell" ref={ref}>
      <button type="button" className="se-theme-btn se-bell__btn" aria-label={`${t('notif', 'title')}${unread ? ` (${unread})` : ''}`}
        aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        🔔{unread > 0 && <span className="se-bell__badge" data-testid="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="se-bell__panel" role="menu">
          <div className="se-bell__head">
            <b>{t('notif', 'title')}</b>
            {unread > 0 && <button type="button" onClick={() => markAll.mutate()}>{t('notif', 'mark_all')}</button>}
          </div>
          {items.length === 0 ? <p className="se-bell__empty">{t('notif', 'empty')}</p> : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" role="menuitem" className={`se-bell__item${n.is_read ? '' : ' unread'}`}
                    onClick={() => { if (!n.is_read) markRead.mutate(n.id); setOpen(false); if (n.link) navigate(n.link); }}>
                    <span className="se-bell__icon" aria-hidden="true">{KIND_ICON[n.kind] ?? '🔔'}</span>
                    <span className="se-bell__text">
                      <b>{n.title}</b>
                      {n.body && <small>{n.body}</small>}
                      {n.created_at && <em>{fmtDateTime(n.created_at)}</em>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
