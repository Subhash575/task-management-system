import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 and status ok when the database is connected', async () => {
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
    expect(typeof res.body.uptime).toBe('number');
  });

  it('returns 503 and status degraded when the database is disconnected', async () => {
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', db: 'disconnected' });
  });

  it('sets security headers and hides the Express fingerprint', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows the configured client origin with credentials', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
