import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from server/.env into process.env (no-op if the file is missing,
// e.g. in Docker where Compose injects them). Skipped in tests so a developer's local
// .env (real secrets, DNS overrides) can never leak into or change test results.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ quiet: true });
}

const DURATION_UNITS_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

// The public placeholder from compose.yaml. Fine for local Docker, fatal in production.
const DEV_PLACEHOLDER_SECRET = 'dev-only-insecure-jwt-secret-do-not-use-in-production';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z
    .string({ error: 'MONGODB_URI is required (copy server/.env.example to server/.env)' })
    .min(1, 'MONGODB_URI is required'),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  // Optional comma-separated DNS server IPs, e.g. "8.8.8.8,1.1.1.1". Only needed when the
  // machine's DNS cannot resolve the SRV records used by mongodb+srv:// URIs.
  DNS_SERVERS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.union([z.ipv4(), z.ipv6()], { error: 'DNS_SERVERS must be IP addresses' }))),

  // Signs session tokens. Anyone who knows it can forge a login, so there is deliberately
  // no default: every environment must provide its own long random value.
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required (see server/.env.example for how to generate one)' })
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  // A number plus a unit: s, m, h, or d (e.g. "15m", "12h", "7d"). Used for BOTH the JWT
  // "exp" claim and the cookie Max-Age, so the two can never drift apart.
  JWT_EXPIRES_IN: z
    .string()
    .trim()
    .regex(/^[1-9]\d*[smhd]$/, 'JWT_EXPIRES_IN must look like "15m", "12h" or "7d"')
    .default('7d'),
  COOKIE_NAME: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/, 'COOKIE_NAME may only contain letters, numbers, "_" and "-"')
    .default('taskflow_session'),
});

const envSchema = baseSchema.refine(
  (data) => !(data.NODE_ENV === 'production' && data.JWT_SECRET === DEV_PLACEHOLDER_SECRET),
  {
    path: ['JWT_SECRET'],
    message: 'JWT_SECRET is the public development placeholder and must not be used in production',
  },
);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Only print variable names and problems — never the values themselves.
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

const { JWT_EXPIRES_IN } = parsed.data;

export const env = Object.freeze({
  ...parsed.data,
  JWT_EXPIRES_IN_MS: Number.parseInt(JWT_EXPIRES_IN, 10) * DURATION_UNITS_MS[JWT_EXPIRES_IN.at(-1)],
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
});
