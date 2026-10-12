import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from server/.env into process.env (no-op if the file is missing,
// e.g. in Docker where Compose injects them).
dotenv.config({ quiet: true });

const envSchema = z.object({
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

export const env = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
});
