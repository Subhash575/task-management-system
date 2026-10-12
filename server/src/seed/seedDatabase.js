// The seeding work itself. Needs an open database connection; the safety checks live in seed.js.
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { TaskStatusChange } from '../models/TaskStatusChange.js';
import { User } from '../models/User.js';
import { hashPassword } from '../utils/password.js';
import { SEED_PASSWORD, SEED_TASKS, SEED_USERS } from './seedData.js';

const DAY_MS = 86_400_000;

/**
 * A fixed ObjectId made from a name. The same name always gives the same id, so on a second run we can
 * ask "does this task already exist?" and skip it instead of creating a duplicate.
 */
function seedId(name) {
  const hex = createHash('sha1').update(`taskflow-seed:${name}`).digest('hex').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

const daysAgo = (days) => new Date(Date.now() - days * DAY_MS);

// The app stores due dates as midnight UTC (calendar days), so do the same.
function dueDate(daysFromToday) {
  const today = new Date();
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + daysFromToday));
}

/** Creates the sample users that don't exist yet. An existing account with the same email is left untouched. */
async function seedUsers() {
  const usersByKey = {};
  let created = 0;
  let passwordHash; // hashing is slow on purpose, so only do it if a user is actually missing

  for (const { key, name, email } of SEED_USERS) {
    let user = await User.findOne({ email });
    if (!user) {
      passwordHash ??= await hashPassword(SEED_PASSWORD);
      user = await new User({ name, email, passwordHash }).save();
      created += 1;
    }
    usersByKey[key] = user;
  }
  return { usersByKey, created };
}

async function seedTasks(usersByKey) {
  let tasksCreated = 0;
  let historyCreated = 0;

  for (const seed of SEED_TASKS) {
    const taskId = seedId(`task:${seed.key}`);
    const createdAt = daysAgo(seed.created);
    const creator = usersByKey[seed.creator];
    const assignee = seed.assignee ? usersByKey[seed.assignee] : null;

    // Never overwrite a task that exists: someone may have edited it since it was seeded.
    if (!(await Task.exists({ _id: taskId }))) {
      // .save() runs the model's normal validation, just like the API does.
      await new Task({
        _id: taskId,
        title: seed.title,
        description: seed.description,
        status: seed.status,
        priority: seed.priority,
        creator: creator._id,
        assignee: assignee?._id ?? null,
        labels: seed.labels,
        dueDate: seed.due === null ? null : dueDate(seed.due),
        createdAt,
      }).save();
      tasksCreated += 1;
    }

    // The task walked through path[0] -> path[1] -> ... -> status. One history row per step.
    const steps = [...seed.path, seed.status];
    for (let index = 1; index < steps.length; index += 1) {
      const changeId = seedId(`history:${seed.key}:${index}`);
      if (await TaskStatusChange.exists({ _id: changeId })) continue;

      // Only the creator or the assignee may change a status, so the history uses one of them.
      const changedBy = assignee && index % 2 === 0 ? assignee : creator;
      await new TaskStatusChange({
        _id: changeId,
        task: taskId,
        from: steps[index - 1],
        to: steps[index],
        changedBy: changedBy._id,
        // Spread the moves between the creation date and now (always in the past).
        changedAt: new Date(createdAt.getTime() + (index * (seed.created * DAY_MS)) / steps.length),
      }).save();
      historyCreated += 1;
    }
  }
  return { tasksCreated, historyCreated };
}

/** Adds whatever sample data is missing and returns how much was newly created. */
export async function seedDatabase() {
  const { usersByKey, created: usersCreated } = await seedUsers();
  const { tasksCreated, historyCreated } = await seedTasks(usersByKey);
  return { usersCreated, tasksCreated, historyCreated };
}
