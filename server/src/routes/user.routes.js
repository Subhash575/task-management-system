import { Router } from 'express';
import { listUsers } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { listUsersQuerySchema } from '../validation/user.schemas.js';

export function createUserRouter() {
  const router = Router();

  // Only signed-in users may see who else is registered.
  router.use(requireAuth);

  router.get('/', validate({ query: listUsersQuerySchema }), listUsers);

  return router;
}
