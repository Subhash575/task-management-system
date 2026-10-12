import { Router } from 'express';
import {
  deleteAttachment,
  downloadAttachment,
  getAttachment,
  listAttachments,
  uploadAttachment,
} from '../controllers/attachment.controller.js';
import { uploadFile } from '../middleware/uploadFile.js';
import { validate } from '../middleware/validate.js';
import { attachmentParamsSchema } from '../validation/attachment.schemas.js';
import { taskIdParamsSchema } from '../validation/task.schemas.js';

/** Mounted by the task router at /tasks/:id/attachments, which already requires a signed-in user. */
export function createAttachmentRouter() {
  const router = Router({ mergeParams: true });

  router.get('/', validate({ params: taskIdParamsSchema }), listAttachments);
  router.post('/', validate({ params: taskIdParamsSchema }), uploadFile, uploadAttachment);
  router.get('/:attachmentId', validate({ params: attachmentParamsSchema }), getAttachment);
  router.get('/:attachmentId/download', validate({ params: attachmentParamsSchema }), downloadAttachment);
  router.delete('/:attachmentId', validate({ params: attachmentParamsSchema }), deleteAttachment);

  return router;
}
