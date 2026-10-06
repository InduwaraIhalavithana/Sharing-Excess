import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '../utils/api';
import { contactSchema, type ContactFormValues } from '../lib/schemas';

const EMPTY: ContactFormValues = { name: '', email: '', subject: '', message: '' };

/** The "Send a Message" form. Failures are reported honestly - a message is never shown as sent unless the server accepted it. */
export default function ContactForm() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: EMPTY,
  });

  const send = useMutation({
    mutationFn: (data: ContactFormValues) => api('/api/contact', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      reset(EMPTY);
      setSent(true);
    },
  });

  if (sent) {
    return (
      <div className="contact-success">
        <span>✅</span>
        <h3>Thank you for reaching out!</h3>
        <p>We'll get back to you within 1–2 business days.</p>
        <button className="btn btn-outline" onClick={() => setSent(false)}>Send another message</button>
      </div>
    );
  }

  const failure = send.error
    ? (send.error instanceof TypeError
      ? 'We could not reach the server. Check your connection and try again - your message has not been sent.'
      : send.error.message)
    : '';

  return (
    <>
      <h2 className="contact-form-wrap__title">Send a Message</h2>
      <form onSubmit={handleSubmit((d) => send.mutate(d))} noValidate>
        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label" htmlFor="cn">Your Name *</label>
            <input id="cn" className="form-control" autoComplete="name" placeholder="Full name" aria-invalid={!!errors.name} {...register('name')} />
            {errors.name && <p className="form-error" role="alert">{errors.name.message}</p>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ce">Email Address *</label>
            <input id="ce" className="form-control" type="email" autoComplete="email" placeholder="you@email.com" aria-invalid={!!errors.email} {...register('email')} />
            {errors.email && <p className="form-error" role="alert">{errors.email.message}</p>}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cs">Subject</label>
          <input id="cs" className="form-control" placeholder="How can we help?" {...register('subject')} />
          {errors.subject && <p className="form-error" role="alert">{errors.subject.message}</p>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cm">Message *</label>
          <textarea id="cm" className="form-control" rows={6} placeholder="Tell us more…" aria-invalid={!!errors.message} {...register('message')} />
          {errors.message && <p className="form-error" role="alert">{errors.message.message}</p>}
        </div>
        {failure && <p className="form-error" role="alert">{failure}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={send.isPending}>
          {send.isPending ? 'Sending…' : 'Send Message'}
        </button>
      </form>
    </>
  );
}
