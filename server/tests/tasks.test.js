import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Task } from '../src/models/Task.js';
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

const createTask = (agent, body = {}) => agent.post('/api/tasks').send({ title: 'Write docs', ...body });

describe('authentication', () => {
  it.each([
    ['post', '/api/tasks'],
    ['get', '/api/tasks'],
    ['get', `/api/tasks/${new mongoose.Types.ObjectId()}`],
    ['patch', `/api/tasks/${new mongoose.Types.ObjectId()}`],
    ['delete', `/api/tasks/${new mongoose.Types.ObjectId()}`],
  ])('%s %s returns 401 without a session', async (method, path) => {
    const res = await request(app)[method](path).send({ title: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBeTruthy();
  });
});

describe('POST /api/tasks', () => {
  it('creates a task with defaults and takes the creator from the session', async () => {
    const ada = await signUp('Ada');

    const res = await createTask(ada.agent);

    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      id: expect.any(String),
      title: 'Write docs',
      description: '',
      status: 'To Do',
      priority: 'Medium',
      assignee: null,
      labels: [],
      dueDate: null,
      creator: { id: ada.id, name: 'Ada', email: 'ada@example.com' },
    });
    expect(res.body.task).not.toHaveProperty('_id');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('ignores a client-supplied creator', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');

    const res = await createTask(ada.agent, { creator: bob.id });

    expect(res.body.task.creator.id).toBe(ada.id);
  });

  it('stores all provided fields, trims text, and de-duplicates labels', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');

    const res = await createTask(ada.agent, {
      title: '  Ship it  ',
      description: 'Details',
      status: 'Idea',
      priority: 'Critical',
      assignee: bob.id,
      labels: ['bug', 'Bug', ' ui '],
      dueDate: '2030-01-15',
    });

    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      title: 'Ship it',
      status: 'Idea',
      priority: 'Critical',
      labels: ['bug', 'ui'],
      assignee: { id: bob.id, name: 'Bob' },
    });
    expect(res.body.task.dueDate).toBe('2030-01-15T00:00:00.000Z');
  });

  it.each([
    ['missing title', { title: undefined }, 'title'],
    ['blank title', { title: '   ' }, 'title'],
    ['title too long', { title: 'x'.repeat(201) }, 'title'],
    ['invalid status', { status: 'Done' }, 'status'],
    ['invalid priority', { priority: 'Urgent' }, 'priority'],
    ['malformed assignee id', { assignee: 'abc' }, 'assignee'],
    ['too many labels', { labels: Array.from({ length: 11 }, (_, i) => `l${i}`) }, 'labels'],
    ['bad due date', { dueDate: 'tomorrow' }, 'dueDate'],
    ['operator object as status', { status: { $ne: 'Idea' } }, 'status'],
  ])('rejects %s with 400', async (_name, body, field) => {
    const ada = await signUp('Ada');

    const res = await ada.agent.post('/api/tasks').send({ title: 'ok', ...body });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
    expect(await Task.countDocuments()).toBe(0);
  });

  it('rejects an assignee that does not exist', async () => {
    const ada = await signUp('Ada');

    const res = await createTask(ada.agent, { assignee: new mongoose.Types.ObjectId().toString() });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ path: 'assignee', message: 'Assignee does not exist' }]);
  });
});

describe('GET /api/tasks', () => {
  it('lists only tasks the user created or is assigned to, newest first', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const cy = await signUp('Cy');
    await createTask(ada.agent, { title: 'Ada private' });
    await createTask(bob.agent, { title: 'Bob to Ada', assignee: ada.id });
    await createTask(bob.agent, { title: 'Bob private' });
    await createTask(cy.agent, { title: 'Cy private' });

    const res = await ada.agent.get('/api/tasks');

    expect(res.status).toBe(200);
    expect(res.body.tasks.map((t) => t.title)).toEqual(['Bob to Ada', 'Ada private']);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('returns an empty page for a user with no tasks', async () => {
    const ada = await signUp('Ada');

    const res = await ada.agent.get('/api/tasks');

    expect(res.body).toEqual({ tasks: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  it('paginates without overlap and reports totals', async () => {
    const ada = await signUp('Ada');
    for (let i = 1; i <= 5; i += 1) await createTask(ada.agent, { title: `Task ${i}` });

    const page1 = await ada.agent.get('/api/tasks?page=1&limit=2');
    const page2 = await ada.agent.get('/api/tasks?page=2&limit=2');
    const page3 = await ada.agent.get('/api/tasks?page=3&limit=2');
    const page4 = await ada.agent.get('/api/tasks?page=4&limit=2');

    expect(page1.body.tasks.map((t) => t.title)).toEqual(['Task 5', 'Task 4']);
    expect(page2.body.tasks.map((t) => t.title)).toEqual(['Task 3', 'Task 2']);
    expect(page3.body.tasks.map((t) => t.title)).toEqual(['Task 1']);
    expect(page4.body.tasks).toEqual([]);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
  });

  it('filters by status and priority', async () => {
    const ada = await signUp('Ada');
    await createTask(ada.agent, { title: 'A', status: 'Idea', priority: 'High' });
    await createTask(ada.agent, { title: 'B', status: 'Idea', priority: 'Low' });
    await createTask(ada.agent, { title: 'C', status: 'Completed', priority: 'High' });

    const byStatus = await ada.agent.get('/api/tasks?status=Idea');
    const byPriority = await ada.agent.get('/api/tasks?priority=High');
    const both = await ada.agent.get('/api/tasks?status=Idea&priority=High');

    expect(byStatus.body.tasks.map((t) => t.title).sort()).toEqual(['A', 'B']);
    expect(byPriority.body.tasks.map((t) => t.title).sort()).toEqual(['A', 'C']);
    expect(both.body.tasks.map((t) => t.title)).toEqual(['A']);
    expect(both.body.pagination.total).toBe(1);
  });

  it('filters by created-by-me and assigned-to-me', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    await createTask(ada.agent, { title: 'Ada created', assignee: bob.id });
    await createTask(bob.agent, { title: 'Bob created, Ada assigned', assignee: ada.id });
    await createTask(ada.agent, { title: 'Ada self-assigned', assignee: ada.id });

    const created = await ada.agent.get('/api/tasks?scope=created');
    const assigned = await ada.agent.get('/api/tasks?scope=assigned');

    expect(created.body.tasks.map((t) => t.title).sort()).toEqual(['Ada created', 'Ada self-assigned']);
    expect(assigned.body.tasks.map((t) => t.title).sort()).toEqual(['Ada self-assigned', 'Bob created, Ada assigned']);
  });

  it.each([
    ['page=0'],
    ['page=abc'],
    ['limit=0'],
    ['limit=101'],
    ['status=Done'],
    ['priority=Urgent'],
    ['scope=everyone'],
  ])('rejects invalid query %s with 400', async (query) => {
    const ada = await signUp('Ada');

    const res = await ada.agent.get(`/api/tasks?${query}`);

    expect(res.status).toBe(400);
  });

  it('never interprets bracketed query keys as Mongo operators', async () => {
    const ada = await signUp('Ada');
    await createTask(ada.agent, { title: 'A', status: 'Idea' });
    await createTask(ada.agent, { title: 'B', status: 'Completed' });

    const res = await ada.agent.get('/api/tasks?status[$ne]=Idea');

    // The unknown key is dropped, so no filter is applied (and certainly no $ne query runs).
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns the task to its creator and to its assignee', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id });
    const url = `/api/tasks/${body.task.id}`;

    const asCreator = await ada.agent.get(url);
    const asAssignee = await bob.agent.get(url);

    expect(asCreator.status).toBe(200);
    expect(asCreator.body.task.id).toBe(body.task.id);
    expect(asAssignee.status).toBe(200);
  });

  it('returns 404 to unrelated users, same as for a missing task', async () => {
    const ada = await signUp('Ada');
    const cy = await signUp('Cy');
    const { body } = await createTask(ada.agent);

    const stranger = await cy.agent.get(`/api/tasks/${body.task.id}`);
    const missing = await cy.agent.get(`/api/tasks/${new mongoose.Types.ObjectId()}`);

    expect(stranger.status).toBe(404);
    expect(stranger.body).toEqual(missing.body);
  });

  it('returns 400 for a malformed id', async () => {
    const ada = await signUp('Ada');

    const res = await ada.agent.get('/api/tasks/not-an-id');

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('lets the creator update any permitted field', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent);

    const res = await ada.agent.patch(`/api/tasks/${body.task.id}`).send({
      title: 'New title',
      description: 'Updated',
      status: 'In Progress',
      priority: 'High',
      assignee: bob.id,
      labels: ['x'],
      dueDate: '2031-02-03T10:00:00Z',
    });

    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({
      title: 'New title',
      description: 'Updated',
      status: 'In Progress',
      priority: 'High',
      assignee: { id: bob.id },
      labels: ['x'],
      dueDate: '2031-02-03T10:00:00.000Z',
    });
    expect(res.body.task.updatedAt).toBeTruthy();
  });

  it('lets the creator clear the assignee and due date with null', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id, dueDate: '2030-01-01' });

    const res = await ada.agent.patch(`/api/tasks/${body.task.id}`).send({ assignee: null, dueDate: null });

    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({ assignee: null, dueDate: null });
  });

  it('lets the assignee update only the status', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id });

    const res = await bob.agent.patch(`/api/tasks/${body.task.id}`).send({ status: 'In Review' });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('In Review');
  });

  it.each([
    ['title', { title: 'Hijacked' }],
    ['priority', { priority: 'Low' }],
    ['assignee', { assignee: null }],
    ['status plus another field', { status: 'Completed', title: 'Sneaky' }],
  ])('forbids the assignee from changing %s', async (_name, change) => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id });

    const res = await bob.agent.patch(`/api/tasks/${body.task.id}`).send(change);

    expect(res.status).toBe(403);
    const stored = await Task.findById(body.task.id);
    expect(stored.title).toBe('Write docs');
    expect(stored.status).toBe('To Do');
    expect(String(stored.assignee)).toBe(bob.id);
  });

  it('returns 404 and changes nothing for an unrelated user', async () => {
    const ada = await signUp('Ada');
    const cy = await signUp('Cy');
    const { body } = await createTask(ada.agent);

    const res = await cy.agent.patch(`/api/tasks/${body.task.id}`).send({ title: 'Hijacked' });

    expect(res.status).toBe(404);
    expect((await Task.findById(body.task.id)).title).toBe('Write docs');
  });

  it('cannot change the creator, even if the client sends one', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent);

    const res = await ada.agent.patch(`/api/tasks/${body.task.id}`).send({ creator: bob.id, title: 'Still mine' });

    expect(res.status).toBe(200);
    expect(res.body.task.creator.id).toBe(ada.id);
  });

  it('rejects assigning to a user that does not exist', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent);

    const res = await ada.agent
      .patch(`/api/tasks/${body.task.id}`)
      .send({ assignee: new mongoose.Types.ObjectId().toString() });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('assignee');
  });

  it.each([
    ['empty body', {}],
    ['only unknown fields', { creator: 'x' }],
    ['invalid status', { status: 'Done' }],
    ['blank title', { title: ' ' }],
  ])('rejects %s with 400', async (_name, change) => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent);

    const res = await ada.agent.patch(`/api/tasks/${body.task.id}`).send(change);

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('lets the creator delete the task', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent);

    const res = await ada.agent.delete(`/api/tasks/${body.task.id}`);

    expect(res.status).toBe(204);
    expect(await Task.countDocuments()).toBe(0);
    expect((await ada.agent.get(`/api/tasks/${body.task.id}`)).status).toBe(404);
  });

  it('forbids the assignee from deleting', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id });

    const res = await bob.agent.delete(`/api/tasks/${body.task.id}`);

    expect(res.status).toBe(403);
    expect(await Task.countDocuments()).toBe(1);
  });

  it('returns 404 for an unrelated user and for a missing task', async () => {
    const ada = await signUp('Ada');
    const cy = await signUp('Cy');
    const { body } = await createTask(ada.agent);

    const stranger = await cy.agent.delete(`/api/tasks/${body.task.id}`);
    const missing = await cy.agent.delete(`/api/tasks/${new mongoose.Types.ObjectId()}`);

    expect(stranger.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await Task.countDocuments()).toBe(1);
  });
});

describe('additional edge cases', () => {
  it('returns identical 404 bodies for unrelated users and missing tasks on PATCH and DELETE', async () => {
    const ada = await signUp('Ada');
    const cy = await signUp('Cy');
    const { body } = await createTask(ada.agent);
    const missingUrl = `/api/tasks/${new mongoose.Types.ObjectId()}`;
    const url = `/api/tasks/${body.task.id}`;

    const strangerPatch = await cy.agent.patch(url).send({ title: 'x' });
    const missingPatch = await cy.agent.patch(missingUrl).send({ title: 'x' });
    const strangerDelete = await cy.agent.delete(url);
    const missingDelete = await cy.agent.delete(missingUrl);

    expect(missingPatch.status).toBe(404);
    expect(strangerPatch.status).toBe(404);
    expect(strangerPatch.body).toEqual(missingPatch.body);
    expect(strangerDelete.body).toEqual(missingDelete.body);
  });

  it('removes access when the creator unassigns or reassigns the old assignee', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const cy = await signUp('Cy');
    const { body } = await createTask(ada.agent, { assignee: bob.id });
    const url = `/api/tasks/${body.task.id}`;

    await ada.agent.patch(url).send({ assignee: cy.id });

    expect((await bob.agent.get(url)).status).toBe(404);
    expect((await bob.agent.patch(url).send({ status: 'Completed' })).status).toBe(404);
    expect((await bob.agent.get('/api/tasks')).body.tasks).toEqual([]);
    expect((await cy.agent.get(url)).status).toBe(200);

    await ada.agent.patch(url).send({ assignee: null });
    expect((await cy.agent.get(url)).status).toBe(404);
  });

  it('lets the assignee move the task to every status', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id });

    for (const status of ['Idea', 'To Do', 'In Progress', 'In Review', 'Completed']) {
      const res = await bob.agent.patch(`/api/tasks/${body.task.id}`).send({ status });
      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe(status);
    }
  });

  it('combines scope with status and priority filters and keeps totals accurate', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    await createTask(bob.agent, { title: 'match', assignee: ada.id, status: 'Idea', priority: 'High' });
    await createTask(bob.agent, { title: 'wrong status', assignee: ada.id, status: 'Completed', priority: 'High' });
    await createTask(ada.agent, { title: 'created by me', status: 'Idea', priority: 'High' });

    const res = await ada.agent.get('/api/tasks?scope=assigned&status=Idea&priority=High&limit=1');

    expect(res.body.tasks.map((t) => t.title)).toEqual(['match']);
    expect(res.body.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
    const beyond = await ada.agent.get('/api/tasks?scope=assigned&status=Idea&page=5');
    expect(beyond.body.tasks).toEqual([]);
    expect(beyond.body.pagination.total).toBe(1);
  });

  it('never exposes secrets and shows only id, name, email for populated users', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { assignee: bob.id });

    const list = await bob.agent.get('/api/tasks');
    const single = await bob.agent.get(`/api/tasks/${body.task.id}`);

    for (const res of [list, single]) {
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('passwordHash');
      expect(raw).not.toMatch(/\$2[aby]\$/);
    }
    expect(Object.keys(single.body.task.creator).sort()).toEqual(['email', 'id', 'name']);
    expect(Object.keys(single.body.task.assignee).sort()).toEqual(['email', 'id', 'name']);
  });

  it('accepts an uppercase-hex task id', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent);

    const res = await ada.agent.get(`/api/tasks/${body.task.id.toUpperCase()}`);

    expect(res.status).toBe(200);
  });

  it('updates labels with de-duplication', async () => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent);

    const res = await ada.agent.patch(`/api/tasks/${body.task.id}`).send({ labels: ['a', 'A', 'b'] });

    expect(res.body.task.labels).toEqual(['a', 'b']);
  });

  it.each([
    ['description too long', { description: 'x'.repeat(5001) }, 'description'],
    ['labels not an array', { labels: 'bug' }, 'labels'],
    ['assignee as a number', { assignee: 123 }, 'assignee'],
    ['assignee as an object', { assignee: { $ne: null } }, 'assignee'],
    ['impossible calendar date', { dueDate: '2030-02-31' }, 'dueDate'],
  ])('rejects %s with 400 on create and update', async (_name, change, field) => {
    const ada = await signUp('Ada');
    const { body } = await createTask(ada.agent);

    const created = await createTask(ada.agent, change);
    const updated = await ada.agent.patch(`/api/tasks/${body.task.id}`).send(change);

    for (const res of [created, updated]) {
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.path)).toContain(field);
    }
  });

  it('returns 401 for a valid token whose user no longer exists', async () => {
    const ada = await signUp('Ada');
    await mongoose.connection.collection('users').deleteMany({});

    const res = await ada.agent.get('/api/tasks');

    expect(res.status).toBe(401);
  });
});
