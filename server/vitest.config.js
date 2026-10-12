import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Tests never connect to a real database; these values only satisfy env validation.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/task-management-test',
      CLIENT_URL: 'http://localhost:5173',
    },
  },
});
