import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { clearAuthCookie, readAuthCookie } from '../utils/authCookie.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Lets the request through only with a valid session cookie whose user still exists.
 * Identity comes solely from the signed token; client-supplied ids are never trusted.
 * On success `req.user` is the safe JSON form of the user (no password hash).
 */
export async function requireAuth(req, res, next) {
  const token = readAuthCookie(req);
  if (!token) {
    throw new AppError(401, 'Authentication required');
  }

  let userId;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    // Malformed, tampered, wrongly signed, or expired. Remove the useless cookie.
    clearAuthCookie(res);
    throw new AppError(401, 'Your session is invalid or has expired. Please log in again.');
  }

  const user = mongoose.isValidObjectId(userId) ? await User.findById(userId) : null;
  if (!user) {
    // The token is genuine but its account is gone (deleted user).
    clearAuthCookie(res);
    throw new AppError(401, 'Your session is invalid or has expired. Please log in again.');
  }

  req.user = user.toJSON();
  next();
}
