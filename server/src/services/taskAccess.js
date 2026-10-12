import { Task } from '../models/Task.js';
import { AppError } from '../utils/AppError.js';

// Only expose what collaborators need to see about the other person.
export const USER_SUMMARY = 'name email';

/** A user can see a task they created or that is assigned to them, and nothing else. */
export const visibleTo = (userId) => ({ $or: [{ creator: userId }, { assignee: userId }] });

/**
 * Loads a task the user may see. Tasks the user may not see are reported as "not found",
 * exactly like missing ones, so ids cannot be probed to learn which tasks exist.
 * Shared by the task and attachment services, so both enforce exactly the same rule.
 */
export async function findVisibleTask(taskId, userId) {
  const task = await Task.findOne({ _id: taskId, ...visibleTo(userId) });
  if (!task) throw new AppError(404, 'Task not found');
  return task;
}
