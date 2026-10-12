import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { useTestDatabase } from './helpers/testDb.js';

useTestDatabase();

let app;
beforeEach(() => {
  app = createApp();
});

const STATUSES = ['Idea', 'To Do', 'In Progress', 'In Review', 'Completed'];
const ZERO = { Idea: 0, 'To Do': 0, 'In Progress': 0, 'In Review': 0, Completed: 0 };

async function signUp(name) {
  const agent = request.agent(app);
  const password = 'correct-horse-battery';
  const res = await agent
    .post('/api/auth/register')
    .send({ name, email: `${name.toLowerCase()}@example.com`, password, confirmPassword: password });
  expect(res.status).toBe(201);
  return { agent, id: res.body.user.id };
}

const createTask = (agent, body = {}) => agent.post('/api/tasks').send({ title: 'T', ...body });
const stats = async (agent) => (await agent.get('/api/tasks/stats')).body.stats;

describe('GET /api/tasks/stats', () => {
  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/tasks/stats');

    expect(res.status).toBe(401);
  });

  it('returns zero for the total and every status when the user has no tasks', async () => {
    const ada = await signUp('Ada');

    const res = await ada.agent.get('/api/tasks/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ stats: { total: 0, byStatus: ZERO } });
  });

  it('counts each of the five statuses exactly', async () => {
    const ada = await signUp('Ada');
    const counts = { Idea: 1, 'To Do': 2, 'In Progress': 3, 'In Review': 4, Completed: 5 };
    for (const status of STATUSES) {
      for (let i = 0; i < counts[status]; i += 1) await createTask(ada.agent, { status });
    }

    expect(await stats(ada.agent)).toEqual({ total: 15, byStatus: counts });
  });

  it('reports a status as 0 when no task has it, and keeps the same keys in the same order', async () => {
    const ada = await signUp('Ada');
    await createTask(ada.agent, { status: 'In Review' });

    const result = await stats(ada.agent);

    expect(Object.keys(result.byStatus)).toEqual(STATUSES);
    expect(result.byStatus).toEqual({ ...ZERO, 'In Review': 1 });
    expect(result.total).toBe(1);
  });

  it('counts tasks the user created and tasks assigned to them, but nobody else\'s', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const cy = await signUp('Cy');
    await createTask(ada.agent, { status: 'Idea' }); // Ada's own
    await createTask(bob.agent, { status: 'To Do', assignee: ada.id }); // assigned to Ada
    await createTask(bob.agent, { status: 'Completed' }); // Bob's private
    await createTask(cy.agent, { status: 'Idea', assignee: bob.id }); // Cy -> Bob
    await createTask(cy.agent, { status: 'In Progress' }); // Cy's private

    expect(await stats(ada.agent)).toEqual({ total: 2, byStatus: { ...ZERO, Idea: 1, 'To Do': 1 } });
    expect(await stats(bob.agent)).toEqual({ total: 3, byStatus: { ...ZERO, Idea: 1, 'To Do': 1, Completed: 1 } });
    expect(await stats(cy.agent)).toEqual({ total: 2, byStatus: { ...ZERO, Idea: 1, 'In Progress': 1 } });
  });

  it('counts a task once when the user is both its creator and its assignee', async () => {
    const ada = await signUp('Ada');
    await createTask(ada.agent, { status: 'In Progress', assignee: ada.id });
    await createTask(ada.agent, { status: 'In Progress', assignee: ada.id });

    expect(await stats(ada.agent)).toEqual({ total: 2, byStatus: { ...ZERO, 'In Progress': 2 } });
  });

  it('follows changes: moved, reassigned and deleted tasks', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const { body } = await createTask(ada.agent, { status: 'To Do', assignee: bob.id });
    expect((await stats(bob.agent)).byStatus['To Do']).toBe(1);

    await bob.agent.patch(`/api/tasks/${body.task.id}`).send({ status: 'Completed' });
    expect(await stats(ada.agent)).toEqual({ total: 1, byStatus: { ...ZERO, Completed: 1 } });

    await ada.agent.patch(`/api/tasks/${body.task.id}`).send({ assignee: null });
    expect((await stats(bob.agent)).total).toBe(0); // no longer visible to Bob

    await ada.agent.delete(`/api/tasks/${body.task.id}`);
    expect(await stats(ada.agent)).toEqual({ total: 0, byStatus: ZERO });
  });

  it('is not mistaken for a task id, and ignores query parameters', async () => {
    const ada = await signUp('Ada');
    await createTask(ada.agent);

    const res = await ada.agent.get('/api/tasks/stats?status=Idea&limit=1&$where=1');

    expect(res.status).toBe(200);
    expect(res.body.stats.total).toBe(1);
  });
});
