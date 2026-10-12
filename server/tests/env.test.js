import { afterEach, describe, expect, it, vi } from 'vitest';

/** Imports a fresh copy of env.js so it re-reads the (stubbed) process.env. */
async function loadEnv() {
  vi.resetModules();
  return (await import('../src/config/env.js')).env;
}

/** Imports env.js expecting validation to fail; returns what was printed to console.error. */
async function loadEnvExpectingFailure() {
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit');
  });
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});

  await expect(loadEnv()).rejects.toThrow('process.exit');
  expect(exit).toHaveBeenCalledWith(1);
  return error.mock.calls.flat().join('\n');
}

describe('environment validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('refuses to start without JWT_SECRET (there is no fallback secret)', async () => {
    vi.stubEnv('JWT_SECRET', undefined);

    const output = await loadEnvExpectingFailure();

    expect(output).toContain('JWT_SECRET is required');
  });

  it('refuses a JWT_SECRET shorter than 32 characters without printing its value', async () => {
    vi.stubEnv('JWT_SECRET', 'too-short-secret-value');

    const output = await loadEnvExpectingFailure();

    expect(output).toContain('JWT_SECRET must be at least 32 characters');
    expect(output).not.toContain('too-short-secret-value');
  });

  it('refuses the public compose.yaml placeholder secret in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'dev-only-insecure-jwt-secret-do-not-use-in-production');

    expect(await loadEnvExpectingFailure()).toContain('must not be used in production');
  });

  // NODE_ENV stays "test" here: switching to "development" would load the developer's real .env.
  it('allows the placeholder secret outside production (local Docker stack)', async () => {
    vi.stubEnv('JWT_SECRET', 'dev-only-insecure-jwt-secret-do-not-use-in-production');

    expect((await loadEnv()).JWT_SECRET).toBe('dev-only-insecure-jwt-secret-do-not-use-in-production');
  });

  it.each(['7 days', '0d', '10', '1w'])('rejects an invalid JWT_EXPIRES_IN of "%s"', async (value) => {
    vi.stubEnv('JWT_EXPIRES_IN', value);

    expect(await loadEnvExpectingFailure()).toContain('JWT_EXPIRES_IN');
  });

  it('rejects a COOKIE_NAME with characters that are not allowed in cookie names', async () => {
    vi.stubEnv('COOKIE_NAME', 'bad name;');

    expect(await loadEnvExpectingFailure()).toContain('COOKIE_NAME');
  });

  it('defaults JWT_EXPIRES_IN to 7d and COOKIE_NAME to taskflow_session', async () => {
    vi.stubEnv('JWT_EXPIRES_IN', undefined);
    vi.stubEnv('COOKIE_NAME', undefined);

    const env = await loadEnv();

    expect(env.JWT_EXPIRES_IN).toBe('7d');
    expect(env.JWT_EXPIRES_IN_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(env.COOKIE_NAME).toBe('taskflow_session');
  });

  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['12h', 43_200_000],
  ])('converts JWT_EXPIRES_IN "%s" to %i ms', async (value, ms) => {
    vi.stubEnv('JWT_EXPIRES_IN', value);

    expect((await loadEnv()).JWT_EXPIRES_IN_MS).toBe(ms);
  });
});
