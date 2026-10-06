import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useRate, useRespondToRequest, useUpdateRequestStatus, type HandoverStatus } from '../hooks/queries';
import type { FoodRequest } from '../types/api';
import { CATEGORY_ICON, fmtDateTime, imgSrc, qty } from '../utils/format';
import { RatingModal, ReasonModal, StatusBadge } from './ui';

type Notify = (msg: string, type?: 'success' | 'error') => void;

type Pending =
  | { kind: 'decline'; req: FoodRequest }
  | { kind: 'cancel'; req: FoodRequest }
  | { kind: 'no_show'; req: FoodRequest }
  | { kind: 'rate'; req: FoodRequest };

const STEPS = ['pending', 'accepted', 'collected', 'completed'] as const;

function Timeline({ status }: { status: FoodRequest['status'] }) {
  const { t } = useLanguage();
  const idx = STEPS.indexOf(status as (typeof STEPS)[number]);
  if (idx < 0) return null;
  return (
    <div className="req-timeline" aria-label={t('status', status)}>
      {STEPS.map((step, i) => (
        <div key={step} className={`req-timeline__step${i <= idx ? ' done' : ''}${i === idx ? ' current' : ''}`}>
          <div className="req-timeline__dot" />
          <span className="req-timeline__label">{t('status', step)}</span>
          {i < STEPS.length - 1 && <div className="req-timeline__line" />}
        </div>
      ))}
    </div>
  );
}

function ContactBox({ req }: { req: FoodRequest }) {
  const { t } = useLanguage();
  const donorSide = req.i_am === 'recipient';
  const rows: [string, string | null | undefined][] = donorSide
    ? [['👤', req.donor.name], ['📞', req.donor.phone], ['✉️', req.donor.email], ['📍', req.donor.address]]
    : [['👤', req.recipient.org_name || req.recipient.name], ['📞', req.recipient.phone], ['✉️', req.recipient.email]];
  const shown = rows.filter(([, v]) => v);
  if (!shown.length || !['accepted', 'collected', 'completed'].includes(req.status)) return null;
  return (
    <div className="req-contact" data-testid="contact-box">
      <b>{donorSide ? t('req', 'donor_contact') : t('req', 'recipient_contact')}</b>
      {shown.map(([icon, v]) => <span key={icon}>{icon} {v}</span>)}
    </div>
  );
}

/**
 * The list of requests for any role, with the buttons that role may press. Used by the donor, recipient and NGO
 * dashboards, so the handover rules (who can mark what) are written once here and enforced by the server.
 */
export default function RequestBoard({ requests, notify, emptyText }: {
  requests: FoodRequest[]; notify: Notify; emptyText?: string;
}) {
  const { t } = useLanguage();
  const respond = useRespondToRequest();
  const setStatus = useUpdateRequestStatus();
  const rate = useRate();
  const [pending, setPending] = useState<Pending | null>(null);

  const run = async (action: () => Promise<{ message?: string }>, fallback: string) => {
    try {
      const res = await action();
      notify(res.message || fallback);
      setPending(null);
    } catch (err) {
      notify((err as Error).message || t('ui', 'action_failed'), 'error');
    }
  };

  const accept = (r: FoodRequest) => run(() => respond.mutateAsync({ requestId: r.id, status: 'accepted' }), t('req', 'accepted_ok'));
  const move = (r: FoodRequest, status: HandoverStatus, reason = '') =>
    run(() => setStatus.mutateAsync({ requestId: r.id, status, reason }), t('req', 'updated_ok'));

  if (requests.length === 0) {
    return <div className="dd-empty"><span className="dd-empty__icon">📭</span><p>{emptyText ?? t('req', 'none')}</p></div>;
  }

  return (
    <>
      <div className="cards-grid">
        {requests.map((r) => {
          const isDonor = r.i_am === 'donor';
          const who = isDonor ? (r.recipient.org_name || r.recipient.name) : r.donor.name;
          return (
            <article key={r.id} className={`dashboard-card req-card req-card--${r.status}`} data-testid={`request-${r.id}`}>
              <div className="dd-card-top">
                {r.listing.image
                  ? <img className="dd-card-img" src={imgSrc(r.listing.image)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <div className="dd-card-img dd-card-img--emoji">{CATEGORY_ICON.other}</div>}
                <div className="dd-card-info">
                  <div className="dd-card-title"><Link to={`/listings/${r.listing.id}`}>{r.listing.food_name}</Link></div>
                  <p className="dd-card-meta">
                    📦 <b>{qty(r.quantity_requested)} {r.listing.unit}</b>
                    {' · '}{isDonor ? '👤' : '🤝'} {who}{r.recipient.kind === 'ngo' && isDonor ? ' (NGO)' : ''}
                  </p>
                  <p className="dd-card-meta">📍 {r.listing.district}{r.listing.area ? ` · ${r.listing.area}` : ''}</p>
                  {r.created_at && <p className="dd-card-meta">🕒 {fmtDateTime(r.created_at)}</p>}
                </div>
                <StatusBadge status={r.status} />
              </div>

              {r.message && <p className="req-message">“{r.message}”</p>}
              {r.status === 'declined' && r.decline_reason && <p className="req-reason">✕ {t('req', 'reason')}: {r.decline_reason}</p>}
              <Timeline status={r.status} />
              <ContactBox req={r} />

              <div className="dd-card-actions">
                {isDonor && r.status === 'pending' && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => accept(r)} disabled={respond.isPending}>✓ {t('req', 'accept')}</button>
                    <button className="btn btn-outline btn-sm btn-outline--danger" onClick={() => setPending({ kind: 'decline', req: r })}>✕ {t('req', 'decline')}</button>
                  </>
                )}
                {r.status === 'accepted' && (
                  <button className="btn btn-primary btn-sm" onClick={() => move(r, 'collected')}>📦 {t('req', 'mark_collected')}</button>
                )}
                {r.status === 'accepted' && isDonor && (
                  <button className="btn btn-outline btn-sm" onClick={() => move(r, 'completed')}>✅ {t('req', 'mark_completed')}</button>
                )}
                {r.status === 'collected' && (
                  <button className="btn btn-primary btn-sm" onClick={() => move(r, 'completed')}>✅ {t('req', 'mark_completed')}</button>
                )}
                {isDonor && r.status === 'accepted' && (
                  <button className="btn btn-outline btn-sm btn-outline--danger" onClick={() => setPending({ kind: 'no_show', req: r })}>🚫 {t('req', 'no_show')}</button>
                )}
                {!isDonor && ['pending', 'accepted'].includes(r.status) && (
                  <button className="btn btn-outline btn-sm btn-outline--danger" onClick={() => setPending({ kind: 'cancel', req: r })}>{t('req', 'cancel')}</button>
                )}
                {isDonor && r.status === 'accepted' && (
                  <button className="btn btn-outline btn-sm btn-outline--danger" onClick={() => setPending({ kind: 'cancel', req: r })}>{t('req', 'cancel')}</button>
                )}
                {r.can_rate && (
                  <button className="btn btn-primary btn-sm" onClick={() => setPending({ kind: 'rate', req: r })}>⭐ {t('ui', 'rate')} {who}</button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {pending?.kind === 'decline' && (
        <ReasonModal
          title={t('req', 'decline_title')} label={t('req', 'decline_label')} confirmLabel={t('req', 'decline')} required danger
          busy={respond.isPending} onClose={() => setPending(null)}
          onConfirm={(reason) => run(() => respond.mutateAsync({ requestId: pending.req.id, status: 'declined', reason }), t('req', 'declined_ok'))}
        />
      )}
      {pending?.kind === 'cancel' && (
        <ReasonModal
          title={t('req', 'cancel_title')} label={t('req', 'cancel_label')} confirmLabel={t('req', 'cancel')} required={false} danger
          busy={setStatus.isPending} onClose={() => setPending(null)}
          onConfirm={(reason) => move(pending.req, 'cancelled', reason)}
        />
      )}
      {pending?.kind === 'no_show' && (
        <ReasonModal
          title={t('req', 'no_show_title')} label={t('req', 'no_show_label')} confirmLabel={t('req', 'no_show')} required={false} danger
          busy={setStatus.isPending} onClose={() => setPending(null)}
          onConfirm={(reason) => move(pending.req, 'no_show', reason)}
        />
      )}
      {pending?.kind === 'rate' && (
        <RatingModal
          whom={pending.req.i_am === 'donor' ? (pending.req.recipient.org_name || pending.req.recipient.name) : pending.req.donor.name}
          busy={rate.isPending} onClose={() => setPending(null)}
          onSubmit={(score, comment) => run(() => rate.mutateAsync({ request_id: pending.req.id, score, comment }), t('ui', 'rating_thanks'))}
        />
      )}
    </>
  );
}
