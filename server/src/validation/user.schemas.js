import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  // Matches part of a name or email, case-insensitively. Empty means "everyone".
  search: z
    .string({ error: 'Search must be text' })
    .trim()
    .max(100, 'Search must be at most 100 characters')
    .default(''),
  limit: z.coerce
    .number({ error: 'Limit must be a number' })
    .int()
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit must be at most 50')
    .default(20),
});
