import mongoose from 'mongoose';

export const TASK_STATUSES = ['Idea', 'To Do', 'In Progress', 'In Review', 'Completed'];
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    status: { type: String, enum: TASK_STATUSES, default: 'To Do', required: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'Medium', required: true },
    // Set once from the authenticated user and never changed afterwards.
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    labels: { type: [{ type: String, trim: true, maxlength: 30 }], default: [] },
    dueDate: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true, // adds `id` (string form of _id)
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Every task query is scoped to "created by me" and/or "assigned to me", and lists are newest first.
taskSchema.index({ creator: 1, createdAt: -1 });
taskSchema.index({ assignee: 1, createdAt: -1 });
taskSchema.index({ creator: 1, status: 1 });
taskSchema.index({ assignee: 1, status: 1 });

export const Task = mongoose.model('Task', taskSchema);
