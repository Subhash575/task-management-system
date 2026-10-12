# CLAUDE.md

Jira-style task management app (MERN + Docker), built one feature at a time. See README.md for structure and commands.

## Working rules
- Implement only the feature requested in the current task. Do not build future phases preemptively.
- Inspect the repo and `git status` before changing anything. Never overwrite work, reset, commit, or push without explicit permission.
- Explain important decisions in beginner-friendly language.
- After changes: run tests, lint, and build for the affected app(s); report files changed, commands run, and real results; suggest a conventional commit message.

## Conventions
- **Server** (`server/`, ESM, Express 5): routes → controllers → services → models. Async errors propagate to `middleware/errorHandler.js` automatically (no asyncHandler wrapper). Throw `AppError(status, message)` for expected errors. Responses for errors use `{ error: { message, details? } }`.
- **Validation:** Zod only, on the server for every request body/query/param. Schemas live in `src/validation/*.schemas.js`. Apply them with `validate({ body, params, query })` from `middleware/validate.js`; controllers read the parsed values from `req.validated.*`, never from raw `req.body`. Env config is validated in `src/config/env.js`.
- **Auth:** protect routes with `requireAuth` (`middleware/requireAuth.js`). It sets `req.user` (safe JSON, `id` is a string). Take identity only from `req.user`, never from client-sent ids. Use the helpers in `utils/password.js`, `utils/jwt.js`, and `utils/authCookie.js`; don't reimplement them.
- **Security:** enforce authorization server-side on every protected resource; never log or return passwords, JWTs, secrets, or credentials. Models must hide sensitive fields (`select: false` + `toJSON` transform).
- **Stateful middleware** (e.g. rate limiters) is created inside router factories (`createApiRouter`/`createAuthRouter`), so each `createApp()` gets fresh state.
- **Client** (`client/`, React + Vite, JS): use `apiRequest` from `src/lib/api.js` for all API calls; TanStack Query for server state; shadcn/ui components in `src/components/ui` (add via `npx shadcn@latest add <name>`); `@/` alias → `src/`.
- **Tests:** server in `server/tests` (Vitest + Supertest via `createApp()`). DB-backed tests call `useTestDatabase()` from `tests/helpers/testDb.js` (mongodb-memory-server). Tests never load `server/.env`; test env values are in `vitest.config.js`. Client tests co-located as `*.test.jsx` using `renderRoute` from `src/test/renderWithProviders.jsx`.
- Every UI must be responsive and accessible, with loading, error, and empty states.
- Never commit `.env` files; keep `.env.example` files up to date.
