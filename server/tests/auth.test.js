import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { useTestDatabase } from './helpers/testDb.js';

useTestDatabase();

const COOKIE_NAME = process.env.COOKIE_NAME;
const JWT_SECRET = process.env.JWT_SECRET;
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;
const SESSION_INVALID = 'Your session is invalid or has expired. Please log in again.';

const validUser = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse-battery',
  confirmPassword: 'correct-horse-battery',
};

/** Returns the raw Set-Cookie string for our session cookie, if any. */
function getSessionCookie(res) {
  return (res.headers['set-cookie'] ?? []).find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
}

/** Builds a Cookie header carrying the given token, as a browser would send it. */
function cookieHeader(token) {
  return `${COOKIE_NAME}=${token}`;
}

/** Asserts that nothing secret leaked into a JSON response body. */
function expectNoSecrets(res, password = validUser.password) {
  const raw = JSON.stringify(res.body);
  expect(raw).not.toContain('passwordHash');
  expect(raw).not.toContain(password);
  expect(raw).not.toMatch(/\$2[aby]\$/); // any bcrypt hash
  expect(raw).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/); // any JWT
}

let app;
beforeEach(() => {
  app = createApp(); // fresh app = fresh rate-limit counters for every test
});

describe('POST /api/auth/register', () => {
  it('creates the user, sets a secure session cookie, and returns a safe user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: '  ADA@Example.com ' });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expectNoSecrets(res);

    const cookie = getSessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(cookie).toMatch(/; Path=\//);
    expect(cookie).toContain(`; Max-Age=${SEVEN_DAYS_IN_SECONDS}`);
    expect(cookie).not.toMatch(/; Secure/); // only set when NODE_ENV=production

    const token = cookie.split(';')[0].split('=')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    expect(payload.sub).toBe(res.body.user.id);
    expect(payload.exp - payload.iat).toBe(SEVEN_DAYS_IN_SECONDS); // same lifetime as the cookie
  });

  it('stores a bcrypt hash (cost 12), never the plaintext password', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const stored = await User.findOne({ email: validUser.email }).select('+passwordHash').lean();
    expect(stored.passwordHash).toMatch(/^\$2b\$12\$/);
    expect(stored.passwordHash).not.toContain(validUser.password);
  });

  it('ignores fields the client is not allowed to set', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, passwordHash: 'not-a-real-hash', role: 'admin', _id: 'x' });

    expect(res.status).toBe(201);
    const stored = await User.findOne({ email: validUser.email }).select('+passwordHash').lean();
    expect(stored.passwordHash).toMatch(/^\$2b\$12\$/);
    expect(stored).not.toHaveProperty('role');
  });

  it('returns 400 with field-level details for invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '   ', email: 'not-an-email', password: 'short', confirmPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    const paths = res.body.error.details.map((detail) => detail.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    expect(getSessionCookie(res)).toBeUndefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/auth/register').send({});

    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((detail) => detail.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password', 'confirmPassword']));
  });

  it('returns 400 on the confirmPassword field when passwords do not match', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, confirmPassword: 'something-else' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ path: 'confirmPassword', message: 'Passwords do not match' }]);
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects passwords longer than bcrypt can handle (72 bytes)', async () => {
    const longPassword = 'a'.repeat(73);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: longPassword, confirmPassword: longPassword });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('password');
  });

  it('returns 409 for an email that is already registered (case-insensitive)', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'ADA@example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { message: 'Email is already in use' } });
    expect(getSessionCookie(res)).toBeUndefined();
    expect(await User.countDocuments()).toBe(1);
  });

  it('returns 409 (not 500) when two sign-ups race for the same email', async () => {
    const [first, second] = await Promise.all([
      request(app).post('/api/auth/register').send(validUser),
      request(app).post('/api/auth/register').send(validUser),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await User.countDocuments()).toBe(1);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  it('logs in with valid credentials, sets the cookie, and returns a safe user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ' ADA@example.com', password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' });
    expectNoSecrets(res);
    const cookie = getSessionCookie(res);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; SameSite=Lax/);
  });

  it('gives an identical 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: validUser.password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({ error: { message: 'Invalid email or password' } });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(getSessionCookie(wrongPassword)).toBeUndefined();
    expect(getSessionCookie(unknownEmail)).toBeUndefined();
  });

  it('returns 400 for invalid login input', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nope', password: '' });

    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((detail) => detail.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'password']));
  });
});

describe('GET /api/auth/me', () => {
  async function registerAndGetToken() {
    const res = await request(app).post('/api/auth/register').send(validUser);
    return {
      user: res.body.user,
      token: getSessionCookie(res).split(';')[0].split('=')[1],
    };
  }

  it('returns the current user for a valid session cookie', async () => {
    const agent = request.agent(app); // keeps cookies between requests, like a browser
    const registered = await agent.post('/api/auth/register').send(validUser);

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(registered.body.user);
    expectNoSecrets(res);
  });

  it('returns 401 when there is no session cookie', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: 'Authentication required' } });
  });

  it('returns 401 and clears the cookie for a tampered token', async () => {
    const { token } = await registerAndGetToken();
    const [header, payload, signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), sub: new mongoose.Types.ObjectId() }),
    ).toString('base64url');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookieHeader(`${header}.${forgedPayload}.${signature}`));

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe(SESSION_INVALID);
    expect(getSessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('returns 401 for a token signed with a different secret', async () => {
    const { user } = await registerAndGetToken();
    const token = jwt.sign({}, 'an-attacker-secret-that-is-also-32-characters-long', { subject: user.id });

    const res = await request(app).get('/api/auth/me').set('Cookie', cookieHeader(token));

    expect(res.status).toBe(401);
  });

  it('returns 401 for an unsigned ("alg: none") token', async () => {
    const { user } = await registerAndGetToken();
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: user.id })}.`;

    const res = await request(app).get('/api/auth/me').set('Cookie', cookieHeader(unsigned));

    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const { user } = await registerAndGetToken();
    const expired = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET, { subject: user.id });

    const res = await request(app).get('/api/auth/me').set('Cookie', cookieHeader(expired));

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe(SESSION_INVALID);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', cookieHeader('not.a.jwt'));

    expect(res.status).toBe(401);
  });

  it('returns 401 (not 400/500) for a validly signed token whose subject is not a user id', async () => {
    const token = jwt.sign({}, JWT_SECRET, { subject: 'not-an-object-id' });

    const res = await request(app).get('/api/auth/me').set('Cookie', cookieHeader(token));

    expect(res.status).toBe(401);
  });

  it('returns 401 when the user has been deleted', async () => {
    const agent = request.agent(app);
    const registered = await agent.post('/api/auth/register').send(validUser);
    await User.findByIdAndDelete(registered.body.user.id);

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe(SESSION_INVALID);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie with matching options, after which /me is unauthenticated', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validUser);
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    const res = await agent.post('/api/auth/logout');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    const cleared = getSessionCookie(res);
    expect(cleared).toMatch(new RegExp(`^${COOKIE_NAME}=;`));
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cleared).toMatch(/; Path=\//);
    expect(cleared).toMatch(/; HttpOnly/);
    expect(cleared).toMatch(/; SameSite=Lax/);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('returns 204 even without a session', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(204);
  });
});

describe('rate limiting', () => {
  it('blocks login after 10 failed attempts with a 429 in the standard error shape', async () => {
    const attempt = () =>
      request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong-password' });

    for (let i = 0; i < 10; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: { message: 'Too many attempts. Please try again later.' } });
    expect(blocked.headers.ratelimit).toBeDefined();
  });

  it('does not count successful logins toward the login limit', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const credentials = { email: validUser.email, password: validUser.password };

    for (let i = 0; i < 11; i += 1) {
      expect((await request(app).post('/api/auth/login').send(credentials)).status).toBe(200);
    }
  });

  it('blocks registration after 10 attempts', async () => {
    for (let i = 0; i < 10; i += 1) {
      await request(app).post('/api/auth/register').send({});
    }
    const blocked = await request(app).post('/api/auth/register').send(validUser);

    expect(blocked.status).toBe(429);
    expect(await User.countDocuments()).toBe(0);
  });
});
