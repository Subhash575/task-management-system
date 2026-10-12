import { z } from 'zod';
import { objectId } from './task.schemas.js';

// The router is mounted at /tasks/:id/attachments, so both ids are available as params.
export const attachmentParamsSchema = z.object({ id: objectId, attachmentId: objectId });
