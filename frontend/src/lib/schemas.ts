import { z } from 'zod';

/** Shared form rules. Messages are written for people, not developers. */

export const phoneField = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[+\d][\d\s\-()]{6,19}$/.test(v), 'Enter a valid phone number');

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(100, 'That name is too long'),
  phone_number: phoneField,
  location: z.string().trim().max(255, 'That location is too long'),
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
