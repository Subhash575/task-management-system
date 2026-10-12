import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { TaskStatusChange } from '../src/models/TaskStatusChange.js';
import { useTestDatabase } from './helpers/testDb.js';

useTestDatabase();

let app;
beforeEach(() => {
  app = createApp();
});

/** Registers a user and returns a Supertest agent that carries their session cookie. */
async function signUp(name) {
  const agent = request.agent(app);
  const password = 'correct-horse-battery';
  const res = await agent
    .post('/api/auth/register')
    .send({ name, email: `${name.toLowerCase()}@example.com`, password, confirmPassword: password });
  expect(res.status).toBe(201);
  return { agent, id: res.body.user.id };
}

const createTask = (agent, body = {}) => agent.post('/api/tasks').send({ title: 'Track me', ...body });
const history = async (agent, taskId) => (await agent.get(`/api/tasks/${taskId}`)).body.task.statusHistory;

describe('GET /api/tasks/:id — detail response', () => {
  it('returns the task with safe creator/assignee details and an empty history for a new task', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id, labels: ['x'], dueDate: '2030-01-01' });

    const res = await ada.agent.get(`/api/tasks/${body.task.id}`);

    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({
      id: body.task.id,
      title: 'Track me',
      status: 'To Do',
      priority: 'Medium',
      labels: ['x'],
      creator: { id: ada.id, name: 'Ada', email: 'ada@example.com' },
      assignee: { id: bob.id, name: 'Bob', email: 'bob@example.com' },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      statusHistory: [],
    });
    expect(Object.keys(res.body.task.creator).sort()).toEqual(['email', 'id', 'name']);
    // Attachments are listed on the detail response (empty here).
    expect(res.body.task.attachments).toEqual([]);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toMatch(/\$2[aby]\$/);
    expect(raw).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
  });

  it('is only available to signed-in users who can see the task', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const cy = await signUp('Cy');
    const { body } = await createTask(ada.agent, { assignee: bob.id });
    const url = `/api/tasks/${body.task.id}`;

    const anonymous = await request(app).get(url);
    const asAssignee = await bob.agent.get(url);
    const stranger = await cy.agent.get(url);
    const missing = await cy.agent.get(`/api/tasks/${new mongoose.Types.ObjectId()}`);

    expect(anonymous.status).toBe(401);
    expect(asAssignee.status).toBe(200);
    expect(stranger.status).toBe(404);
    expect(stranger.body).toEqual(missing.body); // same safe 404 as a task that does not exist
  });

  it('does not include history in create, update or list responses', async () => {
    const ada = await signUp('Ada');
    const created = await createTask(ada.agent);
    const updated = await ada.agent.patch(`/api/tasks/${created.body.task.id}`).send({ status: 'Idea' });
    const list = await ada.agent.get('/api/tasks');

    expect(created.body.task).not.toHaveProperty('statusHistory');
    expect(updated.body.task).not.toHaveProperty('statusHistory');
    expect(list.body.tasks[0]).not.toHaveProperty('statusHistory');
  });
});

describe('status history recording', () => {
  it('records the old status, new status, actor and time when the status changes', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent, { status: 'To Do' });
    const before = Date.now();

    const patch = await ada.agent.patch(`/api/tasks/${body.task.id}`).send({ status: 'In Progress' });
    const entries = await history(ada.agent, body.task.id);

    expect(patch.status).toBe(200);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      id: expect.any(String),
      from: 'To Do',
      to: 'In Progress',
      changedBy: { id: ada.id, name: 'Ada', email: 'ada@example.com' },
      changedAt: expect.any(String),
    });
    const changedAt = new Date(entries[0].changedAt).getTime();
    expect(changedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(changedAt).toBeLessThanOrEqual(Date.now() + 1000);
    expect(Object.keys(entries[0].changedBy).sort()).toEqual(['email', 'id', 'name']);
  });

  it('records nothing when the task is created, even with a non-default status', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent, { status: 'Completed' });

    expect(await history(ada.agent, body.task.id)).toEqual([]);
    expect(await TaskStatusChange.countDocuments()).toBe(0);
  });

  it('records nothing when the status is sent but unchanged', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent, { status: 'In Review' });

    const res = await ada.agent.patch(`/api/tasks/${body.task.id}`).send({ status: 'In Review', title: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe('Renamed');
    expect(await TaskStatusChange.countDocuments()).toBe(0);
  });

  it('records nothing when other fields change', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent);

    await ada.agent
      .patch(`/api/tasks/${body.task.id}`)
      .send({ title: 'New', description: 'd', priority: 'High', labels: ['a'], dueDate: '2030-05-05', assignee: bob.id });

    expect(await TaskStatusChange.countDocuments()).toBe(0);
  });

  it('keeps every transition in chronological order, with the right actor for each', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id, status: 'Idea' });
    const url = `/api/tasks/${body.task.id}`;

    await ada.agent.patch(url).send({ status: 'To Do' });
    await bob.agent.patch(url).send({ status: 'In Progress' });
    await bob.agent.patch(url).send({ status: 'In Review' });
    await ada.agent.patch(url).send({ status: 'In Progress' }); // moved back
    await bob.agent.patch(url).send({ status: 'Completed' });

    const entries = await history(bob.agent, body.task.id);

    expect(entries.map((e) => [e.from, e.to, e.changedBy.name])).toEqual([
      ['Idea', 'To Do', 'Ada'],
      ['To Do', 'In Progress', 'Bob'],
      ['In Progress', 'In Review', 'Bob'],
      ['In Review', 'In Progress', 'Ada'],
      ['In Progress', 'Completed', 'Bob'],
    ]);
    const times = entries.map((e) => new Date(e.changedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // Each entry starts where the previous one ended.
    entries.slice(1).forEach((entry, i) => expect(entry.from).toBe(entries[i].to));
    expect((await ada.agent.get(url)).body.task.status).toBe('Completed');
  });

  it('records a combined update only once, for the status part', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent);

    await ada.agent.patch(`/api/tasks/${body.task.id}`).send({ status: 'In Review', priority: 'Critical', title: 'Both' });

    const entries = await history(ada.agent, body.task.id);
    expect(entries.map((e) => [e.from, e.to])).toEqual([['To Do', 'In Review']]);
  });

  it('uses the signed-in user as the actor, never a client-supplied one', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent);

    await ada.agent
      .patch(`/api/tasks/${body.task.id}`)
      .send({ status: 'Idea', changedBy: bob.id, statusHistory: [{ from: 'x', to: 'y' }] });

    const entries = await history(ada.agent, body.task.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].changedBy.id).toBe(ada.id);
  });

  it('keeps separate histories for separate tasks', async () => {
    const ada = await signUp('Ada');
    const one = await createTask(ada.agent, { title: 'One' });
    const two = await createTask(ada.agent, { title: 'Two' });

    await ada.agent.patch(`/api/tasks/${one.body.task.id}`).send({ status: 'Idea' });
    await ada.agent.patch(`/api/tasks/${two.body.task.id}`).send({ status: 'Completed' });

    expect((await history(ada.agent, one.body.task.id)).map((e) => e.to)).toEqual(['Idea']);
    expect((await history(ada.agent, two.body.task.id)).map((e) => e.to)).toEqual(['Completed']);
  });
});

describe('status history and authorization', () => {
  it('records nothing when an assignee is refused for changing other fields', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id });

    const res = await bob.agent.patch(`/api/tasks/${body.task.id}`).send({ status: 'Completed', title: 'Sneaky' });

    expect(res.status).toBe(403);
    expect(await TaskStatusChange.countDocuments()).toBe(0);
    expect((await ada.agent.get(`/api/tasks/${body.task.id}`)).body.task.status).toBe('To Do');
  });

  it('records nothing when an unrelated user tries to change the status', async () => {
    const ada = await signUp('Ada');
    const cy = await signUp('Cy');
    const { body } = await createTask(ada.agent);

    const res = await cy.agent.patch(`/api/tasks/${body.task.id}`).send({ status: 'Completed' });

    expect(res.status).toBe(404);
    expect(await TaskStatusChange.countDocuments()).toBe(0);
  });

  it('records nothing for an unauthenticated request or an invalid status', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent);
    const url = `/api/tasks/${body.task.id}`;

    const anonymous = await request(app).patch(url).send({ status: 'Idea' });
    const invalid = await ada.agent.patch(url).send({ status: 'Done' });

    expect(anonymous.status).toBe(401);
    expect(invalid.status).toBe(400);
    expect(await TaskStatusChange.countDocuments()).toBe(0);
  });

  it('hides history from users who lose access to the task', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id });
    const url = `/api/tasks/${body.task.id}`;
    await bob.agent.patch(url).send({ status: 'Idea' });

    await ada.agent.patch(url).send({ assignee: null });

    expect((await bob.agent.get(url)).status).toBe(404);
    expect(await history(ada.agent, body.task.id)).toHaveLength(1); // the creator still sees it
  });

  it('deletes a task\'s history together with the task', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent);
    await ada.agent.patch(`/api/tasks/${body.task.id}`).send({ status: 'Idea' });
    expect(await TaskStatusChange.countDocuments()).toBe(1);

    const res = await ada.agent.delete(`/api/tasks/${body.task.id}`);

    expect(res.status).toBe(204);
    expect(await TaskStatusChange.countDocuments()).toBe(0);
  });

  it('has no route of its own for writing history', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent);
    const url = `/api/tasks/${body.task.id}`;

    const post = await ada.agent.post(`${url}/history`).send({ from: 'To Do', to: 'Idea' });
    const put = await ada.agent.put(`${url}/history`).send([]);

    expect([post.status, put.status]).toEqual([404, 404]);
    expect(await TaskStatusChange.countDocuments()).toBe(0);
  });
});
