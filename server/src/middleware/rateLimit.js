import { rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Per-IP limiter for sensitive auth endpoints. Created inside a factory so every app instance
 * (and every test) gets its own counters. Over-limit requests go through the normal error
 * handler, so clients always receive the usual { error: { message } } shape with status 429.
 */
export function createAuthRateLimiter({
  limit,
  windowMs = FIFTEEN_MINUTES,
  skipSuccessfulRequests = false,
  message = 'Too many attempts. Please try again later.',
  keyGenerator,
}) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8', // sends RateLimit / RateLimit-Policy headers
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    handler: (_req, _res, next) => {
      next(new AppError(429, message));
    },
  });
}
