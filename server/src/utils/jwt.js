import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Pin the algorithm so a token claiming a different one (e.g. "none") is always rejected.
const ALGORITHM = 'HS256';

/** Creates a signed session token whose subject (`sub`) is the user id. */
export function signAccessToken(userId) {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    subject: String(userId),
    expiresIn: Math.floor(env.JWT_EXPIRES_IN_MS / 1000),
  });
}

/**
 * Returns the token payload, or throws (JsonWebTokenError / TokenExpiredError /
 * NotBeforeError) when the token is malformed, tampered with, or expired.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
}
