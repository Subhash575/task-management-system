// Client-side checks give instant feedback. The server re-validates everything (it is the source of truth).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_PASSWORD_BYTES = 72 // bcrypt ignores anything longer, so the server rejects it

export function validateLogin({ email, password }) {
  const errors = {}
  if (!email.trim()) errors.email = 'Email is required'
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address'
  if (!password) errors.password = 'Password is required'
  return errors
}

export function validateRegister({ name, email, password, confirmPassword }) {
  const errors = {}
  if (!name.trim()) errors.name = 'Name is required'
  else if (name.trim().length > 100) errors.name = 'Name must be at most 100 characters'

  if (!email.trim()) errors.email = 'Email is required'
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address'

  if (!password) errors.password = 'Password is required'
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters'
  else if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES)
    errors.password = 'Password is too long (maximum 72 bytes)'

  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password'
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match'
  return errors
}

/** Turns the server's `details: [{ path, message }]` into `{ field: message }` (first message per field). */
export function fieldErrorsFromApiError(error, fields) {
  const result = {}
  for (const detail of error?.details ?? []) {
    if (fields.includes(detail.path) && !result[detail.path]) result[detail.path] = detail.message
  }
  return result
}
