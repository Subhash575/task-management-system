import { describe, expect, it } from 'vitest';
import { Task, TASK_PRIORITIES, TASK_STATUSES } from '../src/models/Task.js';
import { TaskStatusChange } from '../src/models/TaskStatusChange.js';
import { User } from '../src/models/User.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { checkSeedAllowed } from '../src/seed/guard.js';
import { seedDatabase } from '../src/seed/seedDatabase.js';
import { SEED_PASSWORD, SEED_TASKS, SEED_USERS } from '../src/seed/seedData.js';
import { useTestDatabase } from './helpers/testDb.js';

describe('seed guard', () => {
  const local = 'mongodb://localhost:27017/task-management';

  it('allows a local development database', () => {
    expect(checkSeedAllowed({ nodeEnv: 'development', mongoUri: local }).ok).toBe(true);
    expect(checkSeedAllowed({ nodeEnv: 'development', mongoUri: 'mongodb://mongo:27017/task-management' }).ok).toBe(true);
    expect(checkSeedAllowed({ nodeEnv: 'development', mongoUri: 'mongodb://127.0.0.1:27017/x' }).ok).toBe(true);
  });

  it('refuses production, test and unset environments', () => {
    for (const nodeEnv of ['production', 'test', undefined]) {
      expect(checkSeedAllowed({ nodeEnv, mongoUri: local }).ok).toBe(false);
    }
  });

  it('refuses hosted databases without leaking credentials', () => {
    const uri = 'mongodb+srv://user:s3cret@cluster0.example.mongodb.net/task-management';
    const verdict = checkSeedAllowed({ nodeEnv: 'development', mongoUri: uri });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).not.toContain('s3cret');
    expect(checkSeedAllowed({ nodeEnv: 'development', mongoUri: 'mongodb://db.example.com:27017/x' }).ok).toBe(false);
  });

  it('refuses a production-looking or missing database name', () => {
    expect(checkSeedAllowed({ nodeEnv: 'development', mongoUri: 'mongodb://localhost:27017/app-prod' }).ok).toBe(false);
    expect(checkSeedAllowed({ nodeEnv: 'development', mongoUri: 'mongodb://localhost:27017' }).ok).toBe(false);
    expect(checkSeedAllowed({ nodeEnv: 'development', mongoUri: 'not a uri' }).ok).toBe(false);
  });
});

describe('seed data', () => {
  useTestDatabase();

  it('creates the expected users, tasks and valid status history', async () => {
    const result = await seedDatabase();
    expect(result.usersCreated).toBe(SEED_USERS.length);
    expect(result.tasksCreated).toBe(SEED_TASKS.length);

    // Every status has several tasks, and every priority is used.
    const tasks = await Task.find();
    for (const status of TASK_STATUSES) {
      expect(tasks.filter((task) => task.status === status).length).toBeGreaterThanOrEqual(2);
    }
    for (const priority of TASK_PRIORITIES) {
      expect(tasks.some((task) => task.priority === priority)).toBe(true);
    }
    expect(tasks.some((task) => task.assignee === null)).toBe(true);
    expect(tasks.some((task) => task.assignee !== null)).toBe(true);
    expect(new Set(tasks.map((task) => String(task.creator))).size).toBeGreaterThan(1);

    // Sample users can log in with the documented password, and only the hash is stored.
    const alex = await User.findOne({ email: 'alex@taskflow.test' }).select('+passwordHash');
    expect(alex.passwordHash).not.toContain(SEED_PASSWORD);
    expect(await verifyPassword(SEED_PASSWORD, alex.passwordHash)).toBe(true);

    // History: made by the creator or assignee, ends at the task's current status, and is in time order.
    const changes = await TaskStatusChange.find().sort({ changedAt: 1 });
    expect(changes.length).toBeGreaterThan(10);
    expect(result.historyCreated).toBe(changes.length);
    for (const task of tasks.filter((candidate) => candidate.status !== 'Idea' || changes.some((c) => c.task.equals(candidate._id)))) {
      const own = changes.filter((change) => change.task.equals(task._id));
      if (own.length === 0) continue;
      expect(own.at(-1).to).toBe(task.status);
      own.forEach((change, index) => {
        expect(change.from).not.toBe(change.to);
        if (index > 0) expect(change.from).toBe(own[index - 1].to);
        const allowed = [task.creator, task.assignee].filter(Boolean).map(String);
        expect(allowed).toContain(String(change.changedBy));
        expect(change.changedAt.getTime()).toBeLessThanOrEqual(Date.now());
      });
    }
  });

  it('is repeatable: a second run adds nothing and keeps edits and real accounts', async () => {
    const realUser = await new User({
      name: 'Real Person',
      email: 'real@example.com',
      passwordHash: await hashPassword('their-own-password'),
    }).save();

    await seedDatabase();
    const counts = async () => [await User.countDocuments(), await Task.countDocuments(), await TaskStatusChange.countDocuments()];
    const before = await counts();

    const task = await Task.findOne({ title: SEED_TASKS[0].title });
    task.title = 'Edited by a person';
    await task.save();

    const second = await seedDatabase();
    expect(second).toEqual({ usersCreated: 0, tasksCreated: 0, historyCreated: 0 });
    expect(await counts()).toEqual(before);
    expect(await Task.exists({ title: 'Edited by a person' })).toBeTruthy();
    expect(await User.findById(realUser._id)).not.toBeNull();
    expect(before[0]).toBe(SEED_USERS.length + 1);
  });
});
