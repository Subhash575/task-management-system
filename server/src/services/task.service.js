import { Task } from '../models/Task.js';
import { TaskStatusChange } from '../models/TaskStatusChange.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { deleteAttachmentsForTask, listAttachmentsForTask } from './attachment.service.js';
import { USER_SUMMARY, findVisibleTask, visibleTo } from './taskAccess.js';

const populateUsers = [
  { path: 'creator', select: USER_SUMMARY },
  { path: 'assignee', select: USER_SUMMARY },
];

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

/** The task plus its status history (oldest change first) and its attachments (oldest first). */
export async function getTask(user, taskId) {
  const task = await findVisibleTask(taskId, user.id);
  await task.populate(populateUsers);

  const changes = await TaskStatusChange.find({ task: task._id })
    .sort({ changedAt: 1, _id: 1 })
    .populate({ path: 'changedBy', select: USER_SUMMARY });

  return {
    ...task.toJSON(),
    statusHistory: changes.map((change) => change.toJSON()),
    attachments: await listAttachmentsForTask(task._id),
  };
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

  // Update atomically and get the document as it was *before*, so the recorded old status is exactly
  // the status this request replaced, even if two people change the task at the same moment.
  const before = await Task.findOneAndUpdate({ _id: task._id }, { $set: changes }, { new: false, runValidators: true });
  if (!before) throw new AppError(404, 'Task not found'); // deleted while we were working

  // History is written here, inside the authorized update, and only when the status really changed.
  if (changes.status && changes.status !== before.status) {
    await TaskStatusChange.create({ task: task._id, from: before.status, to: changes.status, changedBy: user.id });
  }

  return Task.findById(task._id).populate(populateUsers);
}

export async function deleteTask(user, taskId) {
  const task = await findVisibleTask(taskId, user.id);
  if (!task.creator.equals(user.id)) {
    throw new AppError(403, 'Only the creator can delete this task');
  }
  await task.deleteOne();
  await TaskStatusChange.deleteMany({ task: task._id }); // its history goes with it
  await deleteAttachmentsForTask(task._id); // and its files
}
