import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from '../utils/password.js';

// One message for "no such email" and "wrong password", so attackers can't tell them apart.
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

export async function registerUser({ name, email, password }) {
  // Friendly early check. The unique index still protects against two simultaneous
  // sign-ups; that race surfaces as a duplicate-key error, which the error handler maps to 409.
  if (await User.exists({ email })) {
    throw new AppError(409, 'Email is already in use');
  }

  const passwordHash = await hashPassword(password);
  return User.create({ name, email, passwordHash });
}

export async function authenticateUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    await verifyAgainstDummyHash(password);
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  return user;
}
