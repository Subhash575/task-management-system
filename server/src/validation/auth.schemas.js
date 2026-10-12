import { z } from 'zod';

// bcrypt only uses the first 72 bytes of a password and silently ignores the rest,
// so longer passwords are rejected instead of being quietly truncated.
const BCRYPT_MAX_BYTES = 72;
const fitsBcrypt = (value) => Buffer.byteLength(value, 'utf8') <= BCRYPT_MAX_BYTES;

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254, 'Email is too long'));

const password = z
  .string({ error: 'Password is required' })
  .refine(fitsBcrypt, 'Password is too long (maximum 72 bytes)');

// Unknown keys (e.g. "passwordHash" or "role") are stripped by z.object by default,
// so clients can never set fields we did not explicitly allow.
export const registerSchema = z
  .object({
    name: z
      .string({ error: 'Name is required' })
      .trim()
      .min(1, 'Name is required')
      .max(100, 'Name must be at most 100 characters'),
    email,
    password: password.pipe(z.string().min(8, 'Password must be at least 8 characters')),
    confirmPassword: z.string({ error: 'Please confirm your password' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const loginSchema = z.object({
  email,
  password: password.pipe(z.string().min(1, 'Password is required')),
});
