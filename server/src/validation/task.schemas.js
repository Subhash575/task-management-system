import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '../models/Task.js';

const objectId = z.string({ error: 'Id is required' }).regex(/^[a-f\d]{24}$/i, 'Invalid id');

const title = z
  .string({ error: 'Title is required' })
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be at most 200 characters');

const description = z
  .string({ error: 'Description must be text' })
  .trim()
  .max(5000, 'Description must be at most 5000 characters');

const status = z.enum(TASK_STATUSES, { error: `Status must be one of: ${TASK_STATUSES.join(', ')}` });
const priority = z.enum(TASK_PRIORITIES, { error: `Priority must be one of: ${TASK_PRIORITIES.join(', ')}` });

const labels = z
  .array(z.string().trim().min(1, 'Labels cannot be empty').max(30, 'Each label must be at most 30 characters'), {
    error: 'Labels must be a list of text values',
  })
  .max(10, 'A task can have at most 10 labels')
  // Case-insensitive de-duplication that keeps the first spelling.
  .transform((list) => list.filter((label, i) => list.findIndex((l) => l.toLowerCase() === label.toLowerCase()) === i));

// Accepts "2026-12-31" or a full ISO timestamp, and always produces a Date.
const dueDate = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })], { error: 'Due date must be a valid ISO date' })
  .transform((value) => new Date(value));

const assignee = objectId;

export const taskIdParamsSchema = z.object({ id: objectId });

export const createTaskSchema = z.object({
  title,
  description: description.default(''),
  status: status.default('To Do'),
  priority: priority.default('Medium'),
  assignee: assignee.nullable().default(null),
  labels: labels.default([]),
  dueDate: dueDate.nullable().default(null),
});

// Every field is optional; null clears assignee/dueDate. Unknown keys (creator, id, ...) are stripped.
export const updateTaskSchema = z
  .object({
    title,
    description,
    status,
    priority,
    assignee: assignee.nullable(),
    labels,
    dueDate: dueDate.nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const listTasksQuerySchema = z.object({
  page: z.coerce.number({ error: 'Page must be a number' }).int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce
    .number({ error: 'Limit must be a number' })
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .default(20),
  status: status.optional(),
  priority: priority.optional(),
  // "created" = created by me, "assigned" = assigned to me; omitted = everything I can see.
  scope: z.enum(['created', 'assigned'], { error: 'Scope must be "created" or "assigned"' }).optional(),
});
