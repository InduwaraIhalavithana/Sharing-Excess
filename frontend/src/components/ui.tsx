import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useMeta } from '../hooks/queries';

/** Accessible dialog: Escape and a click on the backdrop close it, focus moves inside while it is open. */
export function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    box.current?.querySelector<HTMLElement>('textarea, input, select, button.btn-primary')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-box${wide ? ' modal-box--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={box}>
        <div className="modal-header">
          <h2 id={id}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const STATUS_CLASS: Record<string, string> = {
  active: 'badge-green', sold_out: 'badge-amber', expired: 'badge-gray', closed: 'badge-gray',
  pending: 'badge-amber', accepted: 'badge-blue', declined: 'badge-red', cancelled: 'badge-gray',
  collected: 'badge-blue', completed: 'badge-green', no_show: 'badge-red',
  approved: 'badge-green', rejected: 'badge-red', published: 'badge-green',
  open: 'badge-amber', actioned: 'badge-green', dismissed: 'badge-gray', resolved: 'badge-green',
  suspended: 'badge-red',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  return <span className={`badge ${STATUS_CLASS[status] ?? 'badge-gray'}`}>{t('status', status)}</span>;
}

/** Read-only star row, e.g. average 4.3 shows 4 filled stars. */
export function Stars({ value, count }: { value: number; count?: number }) {
  const full = Math.round(value);
  return (
    <span className="se-stars" aria-label={`${value.toFixed(1)} / 5`}>
      <span aria-hidden="true">{'★'.repeat(full)}<span className="se-stars__off">{'★'.repeat(5 - full)}</span></span>
      <b>{value.toFixed(1)}</b>
      {count !== undefined && <small>({count})</small>}
    </span>
  );
}

export function RatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useLanguage();
  return (
    <div className="se-rating-input" role="radiogroup" aria-label={t('ui', 'your_rating')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}`}
          className={n <= value ? 'on' : ''} onClick={() => onChange(n)}
        >★</button>
      ))}
    </div>
  );
}

/** − / number / + control that never leaves 1..max. */
export function QtyStepper({ value, max, unit, onChange, step = 1 }: {
  value: number; max: number; unit: string; onChange: (n: number) => void; step?: number;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(step, Math.round(n * 100) / 100));
  return (
    <div className="se-stepper">
      <button type="button" aria-label="−" onClick={() => onChange(clamp(value - step))} disabled={value <= step}>−</button>
      <input
        type="number" inputMode="decimal" min={step} max={max} step="any" value={value}
        aria-label="Quantity"
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(0, n))); }}
        onBlur={() => onChange(clamp(value || step))}
      />
      <span className="se-stepper__unit">{unit}</span>
      <button type="button" aria-label="+" onClick={() => onChange(clamp(value + step))} disabled={value >= max}>+</button>
    </div>
  );
}

/** Asks for free text (a reason) before a destructive step. `required` blocks an empty answer. */
export function ReasonModal({ title, label, confirmLabel, required, danger, onConfirm, onClose, busy }: {
  title: string; label: string; confirmLabel: string; required: boolean; danger?: boolean;
  onConfirm: (reason: string) => void; onClose: () => void; busy?: boolean;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = required && !reason.trim();
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!missing) onConfirm(reason.trim()); }} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="reason-text">{label}</label>
          <textarea
            id="reason-text" className={`form-control${touched && missing ? ' error' : ''}`} rows={3} maxLength={500}
            value={reason} onChange={(e) => setReason(e.target.value)}
          />
          {touched && missing && <span className="form-error">{t('ui', 'reason_required')}</span>}
        </div>
        <div className="se-modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('ui', 'cancel')}</button>
          <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>{confirmLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Stars + optional comment, sent as a rating for a completed handover. */
export function RatingModal({ whom, onSubmit, onClose, busy }: {
  whom: string; onSubmit: (score: number, comment: string) => void; onClose: () => void; busy?: boolean;
}) {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  return (
    <Modal title={`${t('ui', 'rate')} ${whom}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setTouched(true); if (score) onSubmit(score, comment.trim()); }} noValidate>
        <RatingInput value={score} onChange={setScore} />
        {touched && !score && <span className="form-error">{t('ui', 'pick_stars')}</span>}
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label" htmlFor="rating-comment">{t('ui', 'comment_optional')}</label>
          <textarea id="rating-comment" className="form-control" rows={3} maxLength={500}
            value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div className="se-modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('ui', 'cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{t('ui', 'send_rating')}</button>
        </div>
      </form>
    </Modal>
  );
}

export function Empty({ icon, children, action }: { icon: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="dd-empty">
      <span className="dd-empty__icon">{icon}</span>
      <p>{children}</p>
      {action}
    </div>
  );
}

/** <select> of the 25 districts (names come from /api/meta so the list lives in one place). */
export function DistrictSelect({ value, onChange, allLabel, id, required, invalid, label }: {
  value: string; onChange: (v: string) => void; allLabel?: string; id?: string; required?: boolean; invalid?: boolean; label?: string;
}) {
  const { data } = useMeta();
  const { t } = useLanguage();
  return (
    <select id={id} aria-label={label ?? t('post', 'district')} className={`form-control${invalid ? ' error' : ''}`} value={value}
      required={required} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel ?? t('ui', 'choose_district')}</option>
      {(data?.districts ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
    </select>
  );
}
