import { Fragment, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { eventFormSchema, type EventFormValues } from '../lib/schemas';
import { useAttendees, useEventAction, useEventImages, useEvents, useMeta, useSaveEvent } from '../hooks/queries';
import type { CommunityEvent } from '../types/api';
import { EVENT_ICON, fmtDateTime, imgSrc } from '../utils/format';
import { DistrictSelect, StatusBadge } from './ui';

type Notify = (msg: string, type?: 'success' | 'error') => void;

const EMPTY: EventFormValues = {
  title: '', description: '', event_type: 'food_drive', district: '', location: '', starts_at: '', ends_at: '',
  capacity: '', contact_name: '', contact_phone: '', contact_email: '',
};
const toInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '');

function Attendees({ eventId }: { eventId: number }) {
  const { t } = useLanguage();
  const { data, isPending } = useAttendees(eventId);
  if (isPending) return <p className="dd-empty-sm">…</p>;
  const people = data?.attendees ?? [];
  if (people.length === 0) return <p className="dd-empty-sm">{t('ngo', 'nobody_yet')}</p>;
  return (
    <ul className="adm-attendees">
      {people.map((p) => <li key={p.id}><strong>{p.name}</strong> · {p.email}{p.phone_number ? ` · ${p.phone_number}` : ''}</li>)}
    </ul>
  );
}

function Photos({ ev, notify }: { ev: CommunityEvent; notify: Notify }) {
  const { t } = useLanguage();
  const { add, remove } = useEventImages();
  const pick = useRef<HTMLInputElement>(null);
  return (
    <div className="pf-photos">
      {ev.images.map((src) => (
        <div key={src} className="pf-photo">
          <img src={imgSrc(src)} alt="" />
          <button type="button" aria-label={t('post', 'remove_photo')}
            onClick={() => remove.mutate({ id: ev.id, url: src }, { onError: (e) => notify(e.message, 'error') })}>✕</button>
        </div>
      ))}
      {ev.images.length < 3 && (
        <button type="button" className="pf-photo pf-photo--add" onClick={() => pick.current?.click()} disabled={add.isPending}>
          <span>📷</span><small>{t('post', 'add_photo')}</small>
        </button>
      )}
      <input ref={pick} type="file" accept="image/*" hidden aria-label={t('post', 'add_photo')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) add.mutate({ id: ev.id, file }, { onError: (err) => notify(err.message, 'error') });
        }} />
    </div>
  );
}

/** An NGO's own events: create, edit, add photos, see who joined, cancel or delete. */
export default function NgoEvents({ ownerId, notify }: { ownerId: number; notify: Notify }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const { data, isPending } = useEvents({ owner_id: ownerId });
  const save = useSaveEvent();
  const action = useEventAction();

  const [editing, setEditing] = useState<CommunityEvent | 'new' | null>(null);
  const [openAttendees, setOpenAttendees] = useState<number | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema), defaultValues: EMPTY,
  });
  const events = [...(data?.events ?? [])].reverse();

  const startEdit = (ev: CommunityEvent | 'new') => {
    reset(ev === 'new' ? { ...EMPTY, district: user?.district ?? '', contact_name: user?.name.replace(/ \(contact\)$/, '') ?? '' } : {
      title: ev.title, description: ev.description, event_type: ev.event_type, district: ev.district, location: ev.location,
      starts_at: toInput(ev.starts_at), ends_at: toInput(ev.ends_at), capacity: ev.capacity === null ? '' : String(ev.capacity),
      contact_name: ev.contact.name ?? '', contact_phone: ev.contact.phone ?? '', contact_email: ev.contact.email ?? '',
    });
    setEditing(ev);
  };

  const onSubmit = (v: EventFormValues) => {
    const id = editing && editing !== 'new' ? editing.id : undefined;
    save.mutate({ id, data: { ...v, ends_at: v.ends_at || null, capacity: v.capacity === '' ? null : Number(v.capacity) } }, {
      onSuccess: (res) => {
        notify(id ? t('ngo', 'event_updated') : t('ngo', 'event_published'));
        if (!id) setEditing(res.event); else setEditing(null);   // a new event stays open so photos can be added
      },
      onError: (err) => notify(err.message, 'error'),
    });
  };

  const run = (ev: CommunityEvent, kind: 'cancel' | 'delete') => {
    const msg = kind === 'cancel' ? t('ngo', 'cancel_confirm') : t('ngo', 'delete_confirm');
    if (!window.confirm(`${msg} "${ev.title}"?`)) return;
    action.mutate({ id: ev.id, action: kind }, {
      onSuccess: () => notify(kind === 'cancel' ? t('ngo', 'cancelled_ok') : t('ngo', 'deleted_ok')),
      onError: (err) => notify(err.message, 'error'),
    });
  };

  const err = (k: keyof EventFormValues) => errors[k] && <p className="form-error" role="alert">{errors[k]?.message}</p>;
  const current = editing && editing !== 'new' ? (data?.events.find((e) => e.id === editing.id) ?? editing) : null;

  return (
    <div>
      <div className="adm-events-head">
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('ngo', 'events_intro')}</p>
        <button className="btn btn-primary btn-sm" onClick={() => startEdit('new')}>+ {t('ngo', 'new_event')}</button>
      </div>

      {editing && (
        <form className="dashboard-card adm-event-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <h3>{editing === 'new' ? t('ngo', 'new_event') : t('ngo', 'edit_event')}</h3>
          <div className="adm-event-form__grid">
            <div className="form-group adm-span-2">
              <label className="form-label" htmlFor="ev-title">{t('ngo', 'ev_title')} *</label>
              <input id="ev-title" className="form-control" {...register('title')} />
              {err('title')}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-type">{t('ngo', 'ev_type')} *</label>
              <select id="ev-type" className="form-control" {...register('event_type')}>
                {(meta?.event_types ?? []).map((k) => <option key={k} value={k}>{EVENT_ICON[k]} {t('etype', k)}</option>)}
              </select>
              {err('event_type')}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-district">{t('post', 'district')} *</label>
              <DistrictSelect id="ev-district" value={watch('district')} onChange={(v) => setValue('district', v, { shouldValidate: true })} invalid={!!errors.district} />
              {err('district')}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-start">{t('ngo', 'ev_starts')} *</label>
              <input id="ev-start" type="datetime-local" className="form-control" {...register('starts_at')} />
              {err('starts_at')}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-end">{t('ngo', 'ev_ends')}</label>
              <input id="ev-end" type="datetime-local" className="form-control" {...register('ends_at')} />
              {err('ends_at')}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-loc">{t('ngo', 'ev_location')} *</label>
              <input id="ev-loc" className="form-control" {...register('location')} />
              {err('location')}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-cap">{t('ngo', 'ev_capacity')}</label>
              <input id="ev-cap" className="form-control" inputMode="numeric" placeholder={t('ngo', 'unlimited')} {...register('capacity')} />
              {err('capacity')}
            </div>
            <div className="form-group adm-span-2">
              <label className="form-label" htmlFor="ev-desc">{t('post', 'description')}</label>
              <textarea id="ev-desc" className="form-control" rows={3} {...register('description')} />
              {err('description')}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-cname">{t('ngo', 'contact_name')} *</label>
              <input id="ev-cname" className="form-control" {...register('contact_name')} />
              {err('contact_name')}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-cphone">{t('post', 'phone')}</label>
              <input id="ev-cphone" type="tel" className="form-control" {...register('contact_phone')} />
              {err('contact_phone')}
            </div>
            <div className="form-group adm-span-2">
              <label className="form-label" htmlFor="ev-cmail">{t('ngo', 'contact_email')}</label>
              <input id="ev-cmail" type="email" className="form-control" {...register('contact_email')} />
              {err('contact_email')}
              <small className="pf-hint">ℹ️ {t('ngo', 'contact_public')}</small>
            </div>
          </div>
          {current && (
            <div className="form-group">
              <span className="form-label">{t('post', 'photos')}</span>
              <Photos ev={current} notify={notify} />
            </div>
          )}
          <div className="adm-event-form__actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={save.isPending}>
              {editing === 'new' ? t('ngo', 'publish') : t('ui', 'save')}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>{current ? t('ui', 'close') : t('ui', 'cancel')}</button>
          </div>
        </form>
      )}

      <div className="od-table-wrap">
        <table className="od-table">
          <thead><tr><th>{t('ngo', 'ev_title')}</th><th>{t('ngo', 'when')}</th><th>{t('post', 'district')}</th><th>{t('ngo', 'joined')}</th><th>{t('ui', 'status')}</th><th /></tr></thead>
          <tbody>
            {isPending && <tr><td colSpan={6}>…</td></tr>}
            {events.map((ev) => (
              <Fragment key={ev.id}>
                <tr>
                  <td><strong>{EVENT_ICON[ev.event_type]} {ev.title}</strong></td>
                  <td>{fmtDateTime(ev.starts_at)}</td>
                  <td>{ev.district}</td>
                  <td>{ev.going}{ev.capacity !== null ? ` / ${ev.capacity}` : ''}</td>
                  <td>{ev.status === 'cancelled' ? <span className="badge badge-red">{t('ngo', 'cancelled')}</span> : ev.is_past ? <span className="badge badge-gray">{t('ngo', 'past')}</span> : <StatusBadge status="published" />}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-outline" onClick={() => setOpenAttendees(openAttendees === ev.id ? null : ev.id)}>👥 {t('ngo', 'whos_coming')}</button>
                      <button className="btn btn-sm btn-outline" onClick={() => startEdit(ev)}>{t('dash', 'edit')}</button>
                      {ev.status === 'published' && !ev.is_past && <button className="btn btn-sm btn-outline" onClick={() => run(ev, 'cancel')}>{t('ngo', 'cancel_event')}</button>}
                      <button className="btn btn-sm adm-btn-danger" onClick={() => run(ev, 'delete')}>{t('ngo', 'delete')}</button>
                    </div>
                  </td>
                </tr>
                {openAttendees === ev.id && <tr><td colSpan={6}><Attendees eventId={ev.id} /></td></tr>}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!isPending && events.length === 0 && <p className="dd-empty-sm">{t('ngo', 'no_events_yet')}</p>}
      </div>
    </div>
  );
}
