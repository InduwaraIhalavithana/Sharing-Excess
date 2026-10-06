import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useCreateListing, useMeta, usePublicStats } from '../hooks/queries';
import { parseApiErrors } from '../utils/formErrors';
import { CATEGORY_ICON, inHours } from '../utils/format';
import Toast, { type ToastState } from './Toast';
import { DistrictSelect } from './ui';

const MAX_PHOTOS = 3;
const MAX_MB = 5;

interface FormState {
  food_name: string; category: string; quantity_total: string; unit: string; district: string; area: string;
  pickup_address: string; contact_phone: string; expires_at: string; prepared_at: string; fulfilment: string;
  description: string; safety_confirmed: boolean;
}

/** Post surplus food: goes live straight away (no review) once it has a photo and the donor's safety tick. */
export default function PostFood() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: meta } = useMeta();
  const { data: stats } = usePublicStats();
  const create = useCreateListing();

  const blank = (): FormState => ({
    food_name: '', category: '', quantity_total: '', unit: 'portions', district: user?.district ?? '', area: '',
    pickup_address: '', contact_phone: user?.phone_number ?? '', expires_at: inHours(24), prepared_at: '', fulfilment: 'pickup',
    description: '', safety_confirmed: false,
  });
  const [f, setF] = useState<FormState>(blank);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [posted, setPosted] = useState<number | null>(null);

  // The district defaults to the donor's own once the profile is known
  useEffect(() => {
    if (user?.district) setF((p) => (p.district ? p : { ...p, district: user.district as string }));
  }, [user?.district]);

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const set = <K extends keyof FormState>(k: K) => (v: FormState[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: '' }));
  };
  const input = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    set(k)(e.target.value as never);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith('image/')) { setToast({ msg: t('post', 'not_image'), type: 'error' }); continue; }
      if (file.size > MAX_MB * 1024 * 1024) { setToast({ msg: t('post', 'too_big'), type: 'error' }); continue; }
      if (next.length < MAX_PHOTOS) next.push(file);
    }
    setFiles(next);
    if (next.length) setErrors((p) => ({ ...p, images: '' }));
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (f.food_name.trim().length < 2) e.food_name = t('post', 'e_name');
    if (!f.category) e.category = t('post', 'e_category');
    const q = Number(f.quantity_total);
    if (!f.quantity_total || !Number.isFinite(q) || q <= 0) e.quantity_total = t('post', 'e_quantity');
    if (!f.district) e.district = t('post', 'e_district');
    if (!f.expires_at) e.expires_at = t('post', 'e_expiry');
    if (files.length === 0) e.images = t('post', 'e_photo');
    if (!f.safety_confirmed) e.safety_confirmed = t('post', 'e_safety');
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const fd = new FormData();
    (Object.keys(f) as (keyof FormState)[]).forEach((k) => { if (k !== 'safety_confirmed') fd.append(k, String(f[k])); });
    fd.append('safety_confirmed', 'true');
    files.forEach((file) => fd.append('images', file));
    try {
      const res = await create.mutateAsync(fd);
      setPosted(res.listing.id);
      setFiles([]);
      setF(blank());
    } catch (err) {
      const fields = parseApiErrors((err as { body?: never }).body);
      if (Object.keys(fields).length && !fields._) setErrors(fields);
      setToast({ msg: (err as Error).message, type: 'error' });
    }
  };

  if (!user) {
    return (
      <div className="container pf-page">
        <div className="dd-empty">
          <span className="dd-empty__icon">🍱</span>
          <p>{t('post', 'login_first')}</p>
          <button className="btn btn-primary" onClick={() => window.dispatchEvent(new Event('openLogin'))}>{t('nav', 'login')}</button>
          <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => window.dispatchEvent(new Event('openSignup'))}>{t('nav', 'signup')}</button>
        </div>
      </div>
    );
  }
  if (user.role !== 'donor') {
    return (
      <div className="container pf-page">
        <div className="dd-empty"><span className="dd-empty__icon">🙅</span><p>{t('post', 'donors_only')}</p>
          <Link className="btn btn-primary btn-sm" to="/food">{t('food', 'browse_title')}</Link></div>
      </div>
    );
  }

  return (
    <div className="container pf-page">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}
      <div className="pf-hero">
        <h1>🍱 {t('post', 'title')}</h1>
        <p>{t('post', 'subtitle')}</p>
        {stats && <span className="pf-hero__chip">🌍 {stats.donors} {t('post', 'donors_sharing')} · {stats.handovers_completed} {t('post', 'handovers')}</span>}
      </div>

      {posted !== null && (
        <div className="pf-success" role="status">
          <b>✅ {t('post', 'live')}</b>
          <span>{t('post', 'live_hint')}</span>
          <div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/listings/${posted}`)}>{t('post', 'view_listing')}</button>
            <button className="btn btn-outline btn-sm" onClick={() => setPosted(null)}>{t('post', 'post_another')}</button>
            <Link className="btn btn-outline btn-sm" to="/donor-dashboard">{t('nav', 'dashboard')}</Link>
          </div>
        </div>
      )}

      <form className="pf-form dashboard-card" onSubmit={submit} noValidate>
        <fieldset>
          <legend>1 · {t('post', 'what')}</legend>
          <div className="form-group">
            <label className="form-label" htmlFor="pf-name">{t('post', 'food_name')} *</label>
            <input id="pf-name" className={`form-control${errors.food_name ? ' error' : ''}`} value={f.food_name} onChange={input('food_name')}
              maxLength={255} placeholder={t('post', 'food_name_ph')} />
            {errors.food_name && <span className="form-error">{errors.food_name}</span>}
          </div>
          <div className="form-group">
            <span className="form-label">{t('food', 'category')} *</span>
            <div className="se-catbar" role="radiogroup" aria-label={t('food', 'category')}>
              {(meta?.categories ?? []).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={f.category === c}
                  className={`se-catchip${f.category === c ? ' on' : ''}`} onClick={() => set('category')(c)}>
                  {CATEGORY_ICON[c]} {t('cat', c)}
                </button>
              ))}
            </div>
            {errors.category && <span className="form-error">{errors.category}</span>}
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="pf-qty">{t('post', 'quantity')} *</label>
              <input id="pf-qty" className={`form-control${errors.quantity_total ? ' error' : ''}`} type="number" inputMode="decimal"
                min="0" step="any" value={f.quantity_total} onChange={input('quantity_total')} placeholder="10" />
              {errors.quantity_total && <span className="form-error">{errors.quantity_total}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-unit">{t('post', 'unit')} *</label>
              <select id="pf-unit" className="form-control" value={f.unit} onChange={input('unit')}>
                {(meta?.units ?? ['portions']).map((u) => <option key={u} value={u}>{t('unit', u)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pf-desc">{t('post', 'description')}</label>
            <textarea id="pf-desc" className="form-control" rows={3} value={f.description} onChange={input('description')}
              placeholder={t('post', 'description_ph')} />
          </div>
        </fieldset>

        <fieldset>
          <legend>2 · {t('post', 'photos')} *</legend>
          <p className="pf-hint">{t('post', 'photos_hint')}</p>
          <div className="pf-photos">
            {previews.map((src, i) => (
              <div key={src} className="pf-photo">
                <img src={src} alt={`${i + 1}`} />
                <button type="button" aria-label={t('post', 'remove_photo')} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            {files.length < MAX_PHOTOS && (
              <label className="pf-photo pf-photo--add">
                <input type="file" accept="image/*" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} aria-label={t('post', 'add_photo')} />
                <span>📷</span><small>{t('post', 'add_photo')}</small>
              </label>
            )}
          </div>
          {errors.images && <span className="form-error">{errors.images}</span>}
        </fieldset>

        <fieldset>
          <legend>3 · {t('post', 'where_when')}</legend>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="pf-district">{t('post', 'district')} *</label>
              <DistrictSelect id="pf-district" value={f.district} onChange={set('district')} invalid={!!errors.district} />
              {errors.district && <span className="form-error">{errors.district}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-area">{t('post', 'area')}</label>
              <input id="pf-area" className="form-control" value={f.area} onChange={input('area')} maxLength={120} placeholder={t('post', 'area_ph')} />
              <small className="pf-hint">{t('post', 'area_hint')}</small>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pf-addr">{t('post', 'address')}</label>
            <input id="pf-addr" className="form-control" value={f.pickup_address} onChange={input('pickup_address')} placeholder={t('post', 'address_ph')} />
            <small className="pf-hint">🔒 {t('post', 'address_hint')}</small>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="pf-exp">{t('post', 'expires')} *</label>
              <input id="pf-exp" className={`form-control${errors.expires_at ? ' error' : ''}`} type="datetime-local" value={f.expires_at} onChange={input('expires_at')} />
              {errors.expires_at && <span className="form-error">{errors.expires_at}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-prep">{t('post', 'prepared')}</label>
              <input id="pf-prep" className="form-control" type="datetime-local" value={f.prepared_at} onChange={input('prepared_at')} />
              <small className="pf-hint">{t('post', 'prepared_hint')}</small>
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="pf-ful">{t('food', 'fulfilment')}</label>
              <select id="pf-ful" className="form-control" value={f.fulfilment} onChange={input('fulfilment')}>
                <option value="pickup">{t('food', 'pickup')}</option>
                <option value="delivery">{t('food', 'delivery')}</option>
                <option value="both">{t('food', 'delivery_or_pickup')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-phone">{t('post', 'phone')}</label>
              <input id="pf-phone" className="form-control" type="tel" value={f.contact_phone} onChange={input('contact_phone')} placeholder="+94 7X XXX XXXX" />
              <small className="pf-hint">🔒 {t('post', 'phone_hint')}</small>
            </div>
          </div>
        </fieldset>

        <label className={`pf-safety${errors.safety_confirmed ? ' pf-safety--error' : ''}`}>
          <input type="checkbox" checked={f.safety_confirmed} onChange={(e) => set('safety_confirmed')(e.target.checked)} />
          <span>{t('post', 'safety')}</span>
        </label>
        {errors.safety_confirmed && <span className="form-error">{errors.safety_confirmed}</span>}

        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={create.isPending}>
          {create.isPending ? t('post', 'posting') : `🚀 ${t('post', 'submit')}`}
        </button>
      </form>
    </div>
  );
}
