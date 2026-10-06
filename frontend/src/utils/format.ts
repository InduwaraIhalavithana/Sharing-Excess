import { APP_ROOT } from '../config';

/** Uploaded photos are stored as "/uploads/x.webp" (served through the app origin) or as full cloud URLs. */
export function imgSrc(path: string | null | undefined): string {
  if (!path) return '';
  return /^https?:\/\//.test(path) ? path : `${APP_ROOT}${path}`;
}

export const CATEGORY_ICON: Record<string, string> = {
  cooked_meals: '🍛', rice_grains: '🍚', vegetables_fruits: '🥕', bakery: '🥖', dairy_eggs: '🥛',
  packaged: '🥫', beverages: '🧃', other: '🍽️',
};

export const EVENT_ICON: Record<string, string> = {
  food_drive: '🥫', volunteering: '🙋', distribution: '📦', awareness: '📣', workshop: '🎓', other: '📅',
};

/** Numbers from the API are decimals: show "2" not "2.00", but keep "1.5". */
export function qty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Times are Sri Lanka wall-clock strings without a zone: show them exactly as stored. */
const dateTime = new Intl.DateTimeFormat('en-LK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dateOnly = new Intl.DateTimeFormat('en-LK', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const timeOnly = new Intl.DateTimeFormat('en-LK', { hour: 'numeric', minute: '2-digit' });

export const fmtDateTime = (iso: string) => dateTime.format(new Date(iso));
export const fmtDate = (iso: string) => dateOnly.format(new Date(iso));
export const fmtTime = (iso: string) => timeOnly.format(new Date(iso));

/** "now" in Sri Lanka as the same naive string format the API uses, so the two can be compared. */
function nowColomboMs(): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')).getTime();
}

export interface TimeLeft { text: string; urgent: boolean; over: boolean }

/** How long until the food expires: "2d 3h", "45 min", "expired". Urgent under 6 hours. */
export function timeLeft(expiresAt: string): TimeLeft {
  const ms = new Date(expiresAt).getTime() - nowColomboMs();
  if (ms <= 0) return { text: '0', urgent: false, over: true };
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  let text: string;
  if (days > 0) text = `${days}d ${hours}h`;
  else if (hours > 0) text = `${hours}h ${mins % 60}m`;
  else text = `${mins}m`;
  return { text, urgent: ms < 6 * 3600 * 1000, over: false };
}

/** Value for <input type="datetime-local"> some hours from now (Sri Lanka time). */
export function inHours(hours: number): string {
  const d = new Date(nowColomboMs() + hours * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Where each role lands after signing in / when it opens "My dashboard". */
export function dashboardPath(role: string | undefined | null): string {
  switch (String(role || '').toLowerCase()) {
    case 'admin': return '/admin';
    case 'recipient': return '/recipient-dashboard';
    case 'ngo': return '/ngo-dashboard';
    case 'donor': return '/donor-dashboard';
    default: return '/';
  }
}
