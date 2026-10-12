// Hostnames that mean "a database on this machine" (127.0.0.1 / localhost, or the "mongo" service in Docker Compose).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'mongo']);

/**
 * Decides whether it is safe to write sample data. Returns `{ ok: true }` or `{ ok: false, reason }`.
 *
 * Seeding is allowed only when ALL of these hold:
 *  1. NODE_ENV is "development" (never "production" or "test").
 *  2. The database is on this machine. A hosted database such as MongoDB Atlas looks the same in development
 *     and production, so there is no reliable way to tell them apart: it is refused.
 *  3. The database name does not look like production.
 * The reason never contains the connection string, so no credentials can leak.
 */
export function checkSeedAllowed({ nodeEnv, mongoUri }) {
  if (nodeEnv !== 'development') {
    return { ok: false, reason: `NODE_ENV is "${nodeEnv}". Seeding only runs when NODE_ENV=development.` };
  }

  let url;
  try {
    url = new URL(mongoUri);
  } catch {
    return { ok: false, reason: 'MONGODB_URI could not be read.' };
  }

  if (url.protocol === 'mongodb+srv:' || !LOCAL_HOSTS.has(url.hostname)) {
    return {
      ok: false,
      reason:
        'MONGODB_URI points to a database that is not on this machine (for example MongoDB Atlas). ' +
        'A hosted database cannot be told apart from production, so the seed refuses to touch it. ' +
        'Use the local Docker MongoDB: mongodb://localhost:27017/task-management',
    };
  }

  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!dbName) return { ok: false, reason: 'MONGODB_URI must name a database (for example .../task-management).' };
  if (/prod/i.test(dbName)) return { ok: false, reason: `The database name "${dbName}" looks like production.` };

  return { ok: true };
}
