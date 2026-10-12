import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { useTestDatabase } from './helpers/testDb.js';

useTestDatabase();

let app;
beforeEach(() => {
  app = createApp();
});

const PASSWORD = 'correct-horse-battery';

/** Registers a user and returns a Supertest agent carrying their session cookie. */
async function signUp(name, email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name, email, password: PASSWORD, confirmPassword: PASSWORD });
  expect(res.status).toBe(201);
  return { agent, id: res.body.user.id };
}

describe('GET /api/users', () => {
  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBeTruthy();
  });

  it('lists registered users with only id, name and email, sorted by name', async () => {
    const cy = await signUp('Cy');
    await signUp('Bob');
    await signUp('Ada');

    const res = await cy.agent.get('/api/users');

    expect(res.status).toBe(200);
    expect(res.body.users.map((u) => u.name)).toEqual(['Ada', 'Bob', 'Cy']);
    for (const user of res.body.users) {
      expect(Object.keys(user).sort()).toEqual(['email', 'id', 'name']);
    }
    expect(res.body.users[2]).toEqual({ id: cy.id, name: 'Cy', email: 'cy@example.com' });
  });

  it('never exposes password hashes, tokens or other fields', async () => {
    const ada = await signUp('Ada');
    await signUp('Bob');

    const res = await ada.agent.get('/api/users');

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain(PASSWORD);
    expect(raw).not.toMatch(/\$2[aby]\$/); // any bcrypt hash
    expect(raw).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/); // any JWT
    expect(raw).not.toContain('createdAt');
    expect(raw).not.toContain('"_id"');
  });

  it('sorts names case-insensitively', async () => {
    const ada = await signUp('ada');
    await signUp('Bob');
    await signUp('charlie');

    const res = await ada.agent.get('/api/users');

    expect(res.body.users.map((u) => u.name)).toEqual(['ada', 'Bob', 'charlie']);
  });

  it('searches by name, case-insensitively and by partial match', async () => {
    const ada = await signUp('Ada Lovelace');
    await signUp('Bob Builder');
    await signUp('Adam Smith');

    const res = await ada.agent.get('/api/users?search=ADA');

    expect(res.body.users.map((u) => u.name)).toEqual(['Ada Lovelace', 'Adam Smith']);
  });

  it('searches by email', async () => {
    const ada = await signUp('Ada', 'ada@example.com');
    await signUp('Bob', 'bob@corp.test');

    const res = await ada.agent.get('/api/users?search=corp.test');

    expect(res.body.users.map((u) => u.name)).toEqual(['Bob']);
  });

  it('trims the search text and treats an empty search as "everyone"', async () => {
    const ada = await signUp('Ada');
    await signUp('Bob');

    const trimmed = await ada.agent.get('/api/users?search=%20%20bob%20');
    const empty = await ada.agent.get('/api/users?search=');

    expect(trimmed.body.users.map((u) => u.name)).toEqual(['Bob']);
    expect(empty.body.users).toHaveLength(2);
  });

  it('returns an empty list when nothing matches', async () => {
    const ada = await signUp('Ada');

    const res = await ada.agent.get('/api/users?search=nobody');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: [] });
  });

  it('treats regex characters in the search literally', async () => {
    const ada = await signUp('Ada');
    await signUp('Bob.Builder', 'bob.builder@example.com');
    await signUp('Bobxbuilder', 'bobxbuilder@example.com');

    const dot = await ada.agent.get('/api/users?search=bob.builder');
    const wildcard = await ada.agent.get('/api/users?search=.*');
    const broken = await ada.agent.get('/api/users?search=(');

    expect(dot.body.users.map((u) => u.name)).toEqual(['Bob.Builder']); // "." is not a wildcard
    expect(wildcard.body.users).toEqual([]);
    expect(broken.status).toBe(200);
    expect(broken.body.users).toEqual([]);
  });

  it('never interprets bracketed query keys as Mongo operators', async () => {
    const ada = await signUp('Ada');
    await signUp('Bob');

    const res = await ada.agent.get('/api/users?search[$ne]=zzz');

    // The unknown key is dropped, so this is just an unfiltered list.
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
  });

  it('applies the limit (default 20, max 50)', async () => {
    const ada = await signUp('Ada');
    // Insert directly: registering 21 users through the API would hit the registration rate limit.
    const bulk = Array.from({ length: 21 }, (_, i) => ({ name: `User ${String(i + 1).padStart(2, '0')}`, email: `user${i + 1}@example.com`, passwordHash: 'not-a-real-hash' }));
    await User.insertMany(bulk);

    const byDefault = await ada.agent.get('/api/users');
    const two = await ada.agent.get('/api/users?limit=2');

    expect(byDefault.body.users).toHaveLength(20);
    expect(two.body.users.map((u) => u.name)).toEqual(['Ada', 'User 01']);
  });

  it.each([
    ['limit=0'],
    ['limit=51'],
    ['limit=abc'],
    ['limit=1.5'],
    [`search=${'x'.repeat(101)}`],
    ['search=a&search=b'],
  ])('rejects invalid query %s with 400', async (query) => {
    const ada = await signUp('Ada');

    const res = await ada.agent.get(`/api/users?${query}`);

    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('works for a freshly registered user as a valid assignee source', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');

    const users = (await ada.agent.get('/api/users')).body.users;
    const task = await ada.agent.post('/api/tasks').send({ title: 'Assigned', assignee: users.find((u) => u.name === 'Bob').id });

    expect(task.status).toBe(201);
    expect(task.body.task.assignee.id).toBe(bob.id);
  });
});
