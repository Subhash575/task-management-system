import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from '../src/middleware/validate.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post(
    '/items/:id',
    validate({
      params: z.object({ id: z.string().regex(/^\d+$/, 'id must be numeric') }),
      query: z.object({ verbose: z.enum(['true', 'false']).default('false') }),
      body: z.object({ title: z.string().trim().min(1, 'Title is required') }),
    }),
    (req, res) => res.json(req.validated),
  );
  app.use(errorHandler);
  return app;
}

describe('validate middleware', () => {
  it('exposes parsed body, params and query on req.validated (trimmed, defaulted, unknown keys stripped)', async () => {
    const res = await request(buildApp()).post('/items/42').send({ title: '  Hello  ', extra: 'dropped' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      params: { id: '42' },
      query: { verbose: 'false' },
      body: { title: 'Hello' },
    });
  });

  it('returns 400 with details when params, query or body are invalid', async () => {
    const res = await request(buildApp()).post('/items/abc?verbose=maybe').send({ title: ' ' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    // Stops at the first invalid part (params are checked first).
    expect(res.body.error.details).toEqual([{ path: 'id', message: 'id must be numeric' }]);
  });

  it('rejects a body that is missing entirely', async () => {
    const app = express();
    app.post('/x', validate({ body: z.object({ title: z.string() }) }), (_req, res) => res.end());
    app.use(errorHandler);

    const res = await request(app).post('/x');

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('title');
  });
});
