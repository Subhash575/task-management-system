import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { AppError } from '../src/utils/AppError.js';

/** A tiny app that throws the given error, so we can test the shared error handler. */
function appThatThrows(error) {
  const app = express();
  app.get('/boom', async () => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

describe('error handling', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(createApp()).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Route not found: GET /api/does-not-exist');
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"bad json"');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Malformed JSON body');
  });

  it('uses the status and message of an AppError thrown from an async handler', async () => {
    const res = await request(appThatThrows(new AppError(403, 'Forbidden'))).get('/boom');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { message: 'Forbidden' } });
  });

  it('maps a Mongoose CastError to 400', async () => {
    const castError = new mongoose.Error.CastError('ObjectId', 'not-an-id', '_id');

    const res = await request(appThatThrows(castError)).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid value for _id');
  });

  it('hides internal details of unexpected errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(appThatThrows(new Error('db password is hunter2'))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Internal server error' } });
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    consoleSpy.mockRestore();
  });
});
