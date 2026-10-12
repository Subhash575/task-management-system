import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('general API rate limit', () => {
  it('returns 429 in the standard error shape after 600 requests, but never limits /api/health', async () => {
    const app = createApp();

    // Unauthenticated requests are cheap (401, no database), and still count toward the limit.
    for (let i = 0; i < 600; i += 1) {
      expect((await request(app).get('/api/auth/me')).status).toBe(401);
    }
    const blocked = await request(app).get('/api/auth/me');

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: { message: 'Too many requests. Please slow down and try again shortly.' } });
    // Hosts ping the health endpoint constantly, so it is deliberately outside the limiter.
    expect((await request(app).get('/api/health')).status).not.toBe(429);
  });
});
