import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useCreateRequest, useListing, useReport } from '../hooks/queries';
import { CATEGORY_ICON, fmtDateTime, imgSrc, qty } from '../utils/format';
import { ExpiryChip, ProximityChip, Stock } from './ListingCard';
import { SkeletonGrid } from './SkeletonCard.jsx';
import Toast, { type ToastState } from './Toast';
import { Empty, QtyStepper, ReasonModal, Stars, StatusBadge } from './ui';

export default function ListingDetail() {
  const { id } = useParams();
  const listingId = Number(id);
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useListing(Number.isFinite(listingId) ? listingId : undefined);
  const create = useCreateRequest();
  const report = useReport();

  const [amount, setAmount] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  if (isPending) return <div className="container" style={{ padding: '40px 0' }}><SkeletonGrid count={1} /></div>;
  if (isError || !data) {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <Empty icon="🔎" action={<Link to="/food" className="btn btn-primary btn-sm">{t('food', 'back_to_browse')}</Link>}>
          {(error as Error | null)?.message ?? t('food', 'gone')}
        </Empty>
      </div>
    );
  }

  const l = data.listing;
  const isOwner = user?.id === l.donor_id;
  const canRequest = !!user && (user.role === 'recipient' || (user.role === 'ngo' && user.ngo_status === 'approved'));
  const open = l.status === 'active' && l.quantity_available > 0;
  const want = amount ?? Math.min(1, l.quantity_available);
  const step = l.unit === 'kg' || l.unit === 'l' ? 0.5 : 1;

  const send = async () => {
    try {
      const res = await create.mutateAsync({ listing_id: l.id, quantity_requested: want, message: message.trim() });
      setToast({ msg: res.message });
      setMessage('');
      setAmount(null);
      setTimeout(() => navigate(user?.role === 'ngo' ? '/ngo-dashboard?tab=requests' : '/recipient-dashboard?tab=requests'), 1400);
    } catch (err) {
      setToast({ msg: (err as Error).message, type: 'error' });
    }
  };

  return (
    <div className="container ld-page">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}
      <nav className="ld-crumbs"><Link to="/food">← {t('food', 'back_to_browse')}</Link></nav>

      <div className="ld-grid">
        <section className="ld-media dashboard-card">
          {l.images.length ? (
            <>
              <img className="ld-hero-img" src={imgSrc(l.images[photo])} alt={l.food_name} />
              {l.images.length > 1 && (
                <div className="ld-thumbs">
                  {l.images.map((src, i) => (
                    <button key={src} type="button" className={i === photo ? 'on' : ''} onClick={() => setPhoto(i)} aria-label={`${i + 1}`}>
                      <img src={imgSrc(src)} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : <div className="ld-hero-img ld-hero-img--emoji">{CATEGORY_ICON[l.category]}</div>}
        </section>

        <section className="ld-info dashboard-card">
          <div className="ld-title-row">
            <h1>{l.food_name}</h1>
            <StatusBadge status={l.status} />
          </div>
          <div className="se-listing__chips">
            <ProximityChip proximity={l.proximity} />
            <ExpiryChip expiresAt={l.expires_at} />
            <span className="se-chip se-chip--gray">{CATEGORY_ICON[l.category]} {t('cat', l.category)}</span>
          </div>
          <Stock l={l} />
          {l.description && <p className="ld-desc">{l.description}</p>}
          <ul className="ld-facts">
            <li>📍 <b>{l.district}</b>{l.area ? ` · ${l.area}` : ''}</li>
            <li>⏰ {t('food', 'expires')}: <b>{fmtDateTime(l.expires_at)}</b></li>
            {l.prepared_at && <li>🍳 {t('food', 'prepared')}: {fmtDateTime(l.prepared_at)}</li>}
            <li>🚚 {t('food', l.fulfilment === 'both' ? 'delivery_or_pickup' : l.fulfilment)}</li>
            <li>🤝 <Link to={`/profile/${l.donor_id}`}>{l.donor_name}</Link>{l.donor_rating && <> · <Stars value={l.donor_rating.average} count={l.donor_rating.count} /></>}</li>
          </ul>

          {l.contact ? (
            <div className="req-contact" data-testid="contact-box">
              <b>✅ {t('req', 'donor_contact')}</b>
              {l.contact.name && <span>👤 {l.contact.name}</span>}
              {l.contact.phone && <span>📞 {l.contact.phone}</span>}
              {l.contact.email && <span>✉️ {l.contact.email}</span>}
              {l.contact.address && <span>📍 {l.contact.address}</span>}
            </div>
          ) : (
            <p className="ld-privacy">🔒 {t('food', 'contact_hidden')}</p>
          )}
          {isOwner && l.pickup_address && <p className="ld-privacy">🏠 {t('food', 'your_address')}: {l.pickup_address}</p>}

          {isOwner ? (
            <Link to="/donor-dashboard" className="btn btn-outline btn-block">{t('food', 'manage')}</Link>
          ) : !user ? (
            <div className="ld-request">
              <p>{t('food', 'login_to_request')}</p>
              <button className="btn btn-primary btn-block" onClick={() => window.dispatchEvent(new Event('openLogin'))}>{t('nav', 'login')}</button>
              <button className="btn btn-outline btn-block" onClick={() => window.dispatchEvent(new Event('openSignup'))}>{t('nav', 'signup')}</button>
            </div>
          ) : user.role === 'ngo' && user.ngo_status !== 'approved' ? (
            <p className="se-notice se-notice--warn">⏳ {t('food', 'ngo_waiting')}</p>
          ) : !canRequest ? (
            <p className="ld-privacy">ℹ️ {t('food', 'only_recipients')}</p>
          ) : !open ? (
            <p className="se-notice se-notice--warn">{l.status === 'sold_out' ? t('food', 'sold_out_msg') : t('food', 'unavailable_msg')}</p>
          ) : (
            <form className="ld-request" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <h2>{t('food', 'request_this')}</h2>
              <label className="form-label">{t('food', 'how_much')} <small>({t('food', 'remaining')}: {qty(l.quantity_available)} {l.unit})</small></label>
              <QtyStepper value={want} max={l.quantity_available} unit={l.unit} step={step} onChange={setAmount} />
              <label className="form-label" htmlFor="req-msg" style={{ marginTop: 10 }}>{t('food', 'message_optional')}</label>
              <textarea id="req-msg" className="form-control" rows={2} maxLength={500} value={message}
                onChange={(e) => setMessage(e.target.value)} placeholder={t('food', 'message_ph')} />
              <button className="btn btn-primary btn-block" type="submit" disabled={create.isPending || want <= 0 || want > l.quantity_available}>
                📦 {t('food', 'send_request')}
              </button>
              <small className="ld-hold">{t('food', 'hold_note')}</small>
            </form>
          )}

          {!isOwner && (
            <button className="ld-report" type="button" onClick={() => setReporting(true)}>🚩 {t('food', 'report')}</button>
          )}
        </section>
      </div>

      {reporting && (
        <ReasonModal
          title={t('food', 'report_title')} label={t('food', 'report_label')} confirmLabel={t('food', 'report')} required danger
          busy={report.isPending} onClose={() => setReporting(false)}
          onConfirm={async (reason) => {
            try {
              const res = await report.mutateAsync({ target_type: 'listing', target_id: l.id, reason });
              setToast({ msg: res.message });
              setReporting(false);
            } catch (err) {
              setToast({ msg: (err as Error).message, type: 'error' });
            }
          }}
        />
      )}
    </div>
  );
}
