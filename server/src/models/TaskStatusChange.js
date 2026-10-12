import mongoose from 'mongoose';
import { TASK_STATUSES } from './Task.js';

/**
 * One row per real status change of a task: what it was, what it became, who did it, and when.
 * Rows are only written by the task update service (never by a route of their own), and are never edited.
 */
const taskStatusChangeSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    from: { type: String, enum: TASK_STATUSES, required: true },
    to: { type: String, enum: TASK_STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now, required: true },
  },
  {
    toJSON: {
      virtuals: true, // adds `id`
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.task; // the caller already knows which task this is
        return ret;
      },
    },
  },
);

// "History of one task, oldest first".
taskStatusChangeSchema.index({ task: 1, changedAt: 1 });

export const TaskStatusChange = mongoose.model('TaskStatusChange', taskStatusChangeSchema);
