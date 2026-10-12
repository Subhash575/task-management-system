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

/** Treats an empty string (a blank line in .env) as if the variable was not set. */
const emptyToUndefined = (schema) => z.preprocess((value) => (value === '' ? undefined : value), schema);

const baseSchema = z.object({
  // Required, with no default: a forgotten NODE_ENV on a host must fail loudly instead of silently running as
  // "development" (which would turn off Secure cookies and show stack traces).
  NODE_ENV: z.enum(['development', 'test', 'production'], {
    error: 'NODE_ENV is required and must be development, test or production',
  }),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z
    .string({ error: 'MONGODB_URI is required (copy server/.env.example to server/.env)' })
    .min(1, 'MONGODB_URI is required'),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  // How many reverse proxies sit in front of the API. Express uses it to find the real client IP (for rate
  // limiting and logs). 1 = a single proxy such as Render's load balancer. With the Vercel /api rewrite there are
  // two (Vercel, then Render), so set 2; too low makes every visitor share Vercel's IP, too high lets clients fake theirs.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
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

  // Where uploaded attachments are stored. "s3" (any S3-compatible bucket: AWS S3, Cloudflare R2, MinIO)
  // is the only driver allowed in production. "local" writes to UPLOAD_DIR for development.
  // "memory" keeps files in RAM and exists for automated tests.
  STORAGE_DRIVER: z.enum(['local', 's3', 'memory']).default('local'),
  UPLOAD_DIR: z.string().trim().min(1).default('uploads'),
  // An empty value in .env counts as "not set".
  S3_BUCKET: emptyToUndefined(z.string().trim().min(1).optional()),
  S3_REGION: emptyToUndefined(z.string().trim().min(1).optional()),
  S3_ENDPOINT: emptyToUndefined(z.url().optional()), // only for non-AWS providers such as R2 or MinIO
  S3_ACCESS_KEY_ID: emptyToUndefined(z.string().trim().min(1).optional()),
  S3_SECRET_ACCESS_KEY: emptyToUndefined(z.string().trim().min(1).optional()),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const envSchema = baseSchema
  .refine(
    (data) => !(data.NODE_ENV === 'production' && data.JWT_SECRET === DEV_PLACEHOLDER_SECRET),
    {
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET is the public development placeholder and must not be used in production',
    },
  )
  // Production must use durable object storage; local disk and memory are not durable on most hosts.
  .refine((data) => !(data.NODE_ENV === 'production' && data.STORAGE_DRIVER !== 's3'), {
    path: ['STORAGE_DRIVER'],
    message: 'STORAGE_DRIVER must be "s3" in production (local disk is not durable)',
  })
  .superRefine((data, ctx) => {
    if (data.STORAGE_DRIVER !== 's3') return;
    for (const name of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
      if (!data[name]) ctx.addIssue({ code: 'custom', path: [name], message: `${name} is required when STORAGE_DRIVER is "s3"` });
    }
  });

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
