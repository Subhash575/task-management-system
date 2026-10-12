import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

// Only expose what collaborators need to see about the other person.
const USER_SUMMARY = 'name email';
const populateUsers = [
  { path: 'creator', select: USER_SUMMARY },
  { path: 'assignee', select: USER_SUMMARY },
];

/** A user can see a task they created or that is assigned to them, and nothing else. */
const visibleTo = (userId) => ({ $or: [{ creator: userId }, { assignee: userId }] });

/**
 * Loads a task the user may see. Tasks the user may not see are reported as "not found",
 * exactly like missing ones, so ids cannot be probed to learn which tasks exist.
 */
async function findVisibleTask(taskId, userId) {
  const task = await Task.findOne({ _id: taskId, ...visibleTo(userId) });
  if (!task) throw new AppError(404, 'Task not found');
  return task;
}

async function assertAssigneeExists(assigneeId) {
  if (assigneeId && !(await User.exists({ _id: assigneeId }))) {
    throw new AppError(400, 'Validation failed', [{ path: 'assignee', message: 'Assignee does not exist' }]);
  }
}

export async function createTask(user, input) {
  await assertAssigneeExists(input.assignee);
  const task = await Task.create({ ...input, creator: user.id });
  return task.populate(populateUsers);
}

export async function listTasks(user, { page, limit, status, priority, scope }) {
  const filter =
    scope === 'created' ? { creator: user.id } : scope === 'assigned' ? { assignee: user.id } : visibleTo(user.id);
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort({ createdAt: -1, _id: -1 }) // _id breaks ties so pages never overlap
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(populateUsers),
    Task.countDocuments(filter),
  ]);

  return { tasks, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getTask(user, taskId) {
  const task = await findVisibleTask(taskId, user.id);
  return task.populate(populateUsers);
}

export async function updateTask(user, taskId, changes) {
  const task = await findVisibleTask(taskId, user.id);
  const isCreator = task.creator.equals(user.id);

  // An assignee may only move their task through the workflow. Everything else is the creator's job.
  if (!isCreator && Object.keys(changes).some((field) => field !== 'status')) {
    throw new AppError(403, 'Assignees can only update the status of a task');
  }

  if ('assignee' in changes && changes.assignee !== String(task.assignee ?? '')) {
    await assertAssigneeExists(changes.assignee);
  }

  task.set(changes);
  await task.save();
  return task.populate(populateUsers);
}

export async function deleteTask(user, taskId) {
  const task = await findVisibleTask(taskId, user.id);
  if (!task.creator.equals(user.id)) {
    throw new AppError(403, 'Only the creator can delete this task');
  }
  await task.deleteOne();
}
