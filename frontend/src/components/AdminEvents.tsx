import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { eventFormSchema, type EventFormValues } from '../lib/schemas';
import { useAttendees, useDeleteEvent, useEvents, useSaveEvent } from '../hooks/queries';
import type { CommunityEvent } from '../types/api';

interface Props {
  /** Shows a toast in the parent page. */
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const EMPTY: EventFormValues = { title: '', description: '', location: '', starts_at: '', ends_at: '', capacity: '' };

/** "2026-10-13T08:00:00" -> "2026-10-13T08:00" (what <input type="datetime-local"> wants) */
const toInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '');

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' });

function Attendees({ eventId }: { eventId: number }) {
  const { data, isPending } = useAttendees(eventId);
  if (isPending) return <p className="dd-empty-sm">Loading…</p>;
  const people = data?.attendees ?? [];
  if (people.length === 0) return <p className="dd-empty-sm">Nobody has joined yet.</p>;
  return (
    <ul className="adm-attendees">
      {people.map((p) => (
        <li key={p.id}>
          <strong>{p.name}</strong> · {p.email}{p.phone_number ? ` · ${p.phone_number}` : ''}
        </li>
      ))}
    </ul>
  );
}

export default function AdminEvents({ notify }: Props) {
  const { data, isPending } = useEvents();
  const save = useSaveEvent();
  const remove = useDeleteEvent();

  const [editing, setEditing] = useState<CommunityEvent | 'new' | null>(null);
  const [openAttendees, setOpenAttendees] = useState<number | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: EMPTY,
  });

  const events = [...(data?.events ?? [])].reverse(); // newest date first

  const startEdit = (ev: CommunityEvent | 'new') => {
    reset(
      ev === 'new'
        ? EMPTY
        : {
          title: ev.title,
          description: ev.description,
          location: ev.location,
          starts_at: toInput(ev.starts_at),
          ends_at: toInput(ev.ends_at),
          capacity: ev.capacity === null ? '' : String(ev.capacity),
        },
    );
    setEditing(ev);
  };

  const onSubmit = (v: EventFormValues) => {
    const id = editing && editing !== 'new' ? editing.id : undefined;
    save.mutate(
      {
        id,
        data: {
          title: v.title,
          description: v.description,
          location: v.location,
          starts_at: v.starts_at,
          ends_at: v.ends_at || null,
          capacity: v.capacity === '' ? null : Number(v.capacity),
        },
      },
      {
        onSuccess: () => {
          notify(id ? 'Event updated.' : 'Event published. Subscribers are being emailed.');
          setEditing(null);
        },
        onError: (err) => notify(err.message, 'error'),
      },
    );
  };

  const onDelete = (ev: CommunityEvent) => {
    if (!window.confirm(`Delete "${ev.title}"? ${ev.going ? `${ev.going} people have joined.` : ''} This cannot be undone.`)) return;
    remove.mutate(ev.id, {
      onSuccess: () => notify('Event deleted.'),
      onError: (err) => notify(err.message, 'error'),
    });
  };

  return (
    <div>
      <div className="adm-events-head">
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Publish food drives and volunteer sessions. Everyone sees them on the Events page and subscribers get an email.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => startEdit('new')}>+ New event</button>
      </div>

      {editing && (
        <form className="dashboard-card adm-event-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <h3>{editing === 'new' ? 'New event' : 'Edit event'}</h3>
          <div className="adm-event-form__grid">
            <div className="form-group adm-span-2">
              <label className="form-label" htmlFor="ev-title">Title *</label>
              <input id="ev-title" className="form-control" {...register('title')} />
              {errors.title && <p className="form-error" role="alert">{errors.title.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-start">Starts *</label>
              <input id="ev-start" type="datetime-local" className="form-control" {...register('starts_at')} />
              {errors.starts_at && <p className="form-error" role="alert">{errors.starts_at.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-end">Ends</label>
              <input id="ev-end" type="datetime-local" className="form-control" {...register('ends_at')} />
              {errors.ends_at && <p className="form-error" role="alert">{errors.ends_at.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-loc">Location *</label>
              <input id="ev-loc" className="form-control" {...register('location')} />
              {errors.location && <p className="form-error" role="alert">{errors.location.message}</p>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ev-cap">Capacity</label>
              <input id="ev-cap" className="form-control" inputMode="numeric" placeholder="Empty = unlimited" {...register('capacity')} />
              {errors.capacity && <p className="form-error" role="alert">{errors.capacity.message}</p>}
            </div>
            <div className="form-group adm-span-2">
              <label className="form-label" htmlFor="ev-desc">Description</label>
              <textarea id="ev-desc" className="form-control" rows={3} {...register('description')} />
              {errors.description && <p className="form-error" role="alert">{errors.description.message}</p>}
            </div>
          </div>
          <div className="adm-event-form__actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing === 'new' ? 'Publish event' : 'Save changes'}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="od-table-wrap">
        <table className="od-table">
          <thead>
            <tr><th>Event</th><th>When</th><th>Where</th><th>Joined</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isPending && <tr><td colSpan={6}>Loading…</td></tr>}
            {events.map((ev) => (
              <Fragment key={ev.id}>
                <tr>
                  <td><strong>{ev.title}</strong></td>
                  <td>{fmt(ev.starts_at)}</td>
                  <td>{ev.location}</td>
                  <td>{ev.going}{ev.capacity !== null ? ` / ${ev.capacity}` : ''}</td>
                  <td><span className={`badge ${ev.is_past ? 'badge-gray' : ev.full ? 'badge-red' : 'badge-green'}`}>{ev.is_past ? 'past' : ev.full ? 'full' : 'upcoming'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm adm-btn-warn" onClick={() => setOpenAttendees(openAttendees === ev.id ? null : ev.id)}>👥 Who's coming</button>
                      <button className="btn btn-sm btn-outline" onClick={() => startEdit(ev)}>Edit</button>
                      <button className="btn btn-sm adm-btn-danger" onClick={() => onDelete(ev)}>Delete</button>
                    </div>
                  </td>
                </tr>
                {openAttendees === ev.id && (
                  <tr>
                    <td colSpan={6}><Attendees eventId={ev.id} /></td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!isPending && events.length === 0 && <p className="dd-empty-sm">No events yet. Press "New event" to publish the first one.</p>}
      </div>
    </div>
  );
}
