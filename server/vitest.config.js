import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Database-backed tests start their own in-memory MongoDB (tests/helpers/testDb.js).
    // The first run downloads a mongod binary, so hooks get extra time.
    hookTimeout: 120_000,
    testTimeout: 30_000,
    // Fixed test-only values. Real secrets live in server/.env, which tests never load.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/task-management-test',
      CLIENT_URL: 'http://localhost:5173',
      JWT_SECRET: 'test-only-jwt-secret-that-is-at-least-32-characters',
      JWT_EXPIRES_IN: '7d',
      COOKIE_NAME: 'taskflow_session',
    },
  },
});
