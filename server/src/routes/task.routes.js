import { Router } from 'express';
import { createTask, deleteTask, getTask, listTasks, updateTask } from '../controllers/task.controller.js';
import { createAttachmentRouter } from './attachment.routes.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParamsSchema,
  updateTaskSchema,
} from '../validation/task.schemas.js';

export function createTaskRouter() {
  const router = Router();

  // Every task endpoint requires a signed-in user.
  router.use(requireAuth);

  router.post('/', validate({ body: createTaskSchema }), createTask);
  router.get('/', validate({ query: listTasksQuerySchema }), listTasks);
  router.get('/:id', validate({ params: taskIdParamsSchema }), getTask);
  router.patch('/:id', validate({ params: taskIdParamsSchema, body: updateTaskSchema }), updateTask);
  router.delete('/:id', validate({ params: taskIdParamsSchema }), deleteTask);

  router.use('/:id/attachments', createAttachmentRouter());

  return router;
}
