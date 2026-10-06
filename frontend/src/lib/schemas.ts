import { z } from 'zod';

/** Shared form rules. Messages are written for people, not developers. */

const phoneField = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[+\d][\d\s\-()]{6,19}$/.test(v), 'Enter a valid phone number');

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(100, 'That name is too long'),
  phone_number: phoneField,
  location: z.string().trim().max(255, 'That location is too long'),
  district: z.string().min(1, 'Choose your district'),
});
export type ProfileForm = z.infer<typeof profileSchema>;

export const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: z.string().min(8, 'Use at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ['confirm_password'],
    message: 'The two passwords do not match',
  })
  .refine((d) => d.new_password !== d.current_password, {
    path: ['new_password'],
    message: 'Choose a password different from the current one',
  });
export type PasswordForm = z.infer<typeof passwordSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name'),
  email: z.string().trim().email('Enter a valid email address'),
  subject: z.string().trim().max(150, 'Keep the subject under 150 characters'),
  message: z.string().trim().min(10, 'Please write at least a few words (10 characters)').max(3000, 'That message is too long'),
});
export type ContactFormValues = z.infer<typeof contactSchema>;


/** NGO "new / edit event" form. Everything is a string here (that is what inputs give us). */
export const eventFormSchema = z
  .object({
    title: z.string().trim().min(3, 'Give the event a title (3+ characters)').max(200),
    description: z.string().trim().max(2000, 'Keep the description under 2000 characters'),
    event_type: z.string().min(1, 'Choose a type'),
    district: z.string().min(1, 'Choose a district'),
    location: z.string().trim().min(2, 'Where is it happening?').max(255),
    starts_at: z.string().min(1, 'Choose when it starts'),
    ends_at: z.string(),
    capacity: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 10000), 'Enter a number from 1 to 10000, or leave empty for unlimited'),
    contact_name: z.string().trim().min(2, 'Who should people contact?').max(120),
    contact_phone: phoneField,
    contact_email: z.string().trim().refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), 'Enter a valid email address'),
  })
  .refine((d) => d.ends_at === '' || d.ends_at > d.starts_at, {
    path: ['ends_at'],
    message: 'The end must be after the start',
  })
  .refine((d) => d.contact_phone !== '' || d.contact_email !== '', {
    path: ['contact_phone'],
    message: 'Give a phone number or an email so people can reach you',
  });
export type EventFormValues = z.infer<typeof eventFormSchema>;

export const emailSchema = z.string().trim().email('Enter a valid email address');

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm'),
  understood: z.literal(true, { message: 'Tick the box to confirm you understand' }),
});
export type DeleteAccountForm = z.infer<typeof deleteAccountSchema>;
