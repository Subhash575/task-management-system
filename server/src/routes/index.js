import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { createAuthRouter } from './auth.routes.js';
import { createTaskRouter } from './task.routes.js';
import { createUserRouter } from './user.routes.js';

/** Built per app instance so stateful middleware (rate-limit counters) is never shared. */
export function createApiRouter() {
  const router = Router();

  router.use('/health', healthRoutes);
  router.use('/auth', createAuthRouter());
  router.use('/tasks', createTaskRouter());
  router.use('/users', createUserRouter());

  return router;
}
