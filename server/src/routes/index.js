import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { createAuthRateLimiter } from '../middleware/rateLimit.js';
import { createAuthRouter } from './auth.routes.js';
import { createTaskRouter } from './task.routes.js';
import { createUserRouter } from './user.routes.js';

/** Built per app instance so stateful middleware (rate-limit counters) is never shared. */
export function createApiRouter() {
  const router = Router();

  // Health checks come first so a host's frequent pings never count against the limit.
  router.use('/health', healthRoutes);
  // A generous per-IP ceiling on everything else: stops scripted abuse, never bothers normal use.
  router.use(createAuthRateLimiter({ limit: 600, message: 'Too many requests. Please slow down and try again shortly.' }));
  router.use('/auth', createAuthRouter());
  router.use('/tasks', createTaskRouter());
  router.use('/users', createUserRouter());

  return router;
}
