import { Router } from 'express';
import { getCurrentUser, login, logout, register } from '../controllers/auth.controller.js';
import { createAuthRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validation/auth.schemas.js';

export function createAuthRouter() {
  const router = Router();

  // Login only counts failed attempts, so a user who logs in successfully is never locked out,
  // while password guessing is capped at 10 tries per 15 minutes per IP.
  const loginLimiter = createAuthRateLimiter({ limit: 10, skipSuccessfulRequests: true });
  const registerLimiter = createAuthRateLimiter({ limit: 10 });

  router.post('/register', registerLimiter, validate({ body: registerSchema }), register);
  router.post('/login', loginLimiter, validate({ body: loginSchema }), login);
  router.post('/logout', logout);
  router.get('/me', requireAuth, getCurrentUser);

  return router;
}
