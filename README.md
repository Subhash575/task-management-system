# TaskFlow — Jira-style Task Management System

A MERN-stack (MongoDB, Express, React, Node.js) task manager with a Kanban board, built incrementally.

> **Status:** scaffold, backend authentication API, and frontend authentication (login, register, session restore, protected routes, logout), and the backend task API. Task pages in the UI, Kanban, attachments, and the dashboard are not implemented yet.

## Project structure

```
.
├── client/          React + Vite + Tailwind CSS + shadcn/ui frontend
│   └── src/
│       ├── app/         router + TanStack Query client
│       ├── components/  layout/ and shadcn ui/ components
│       ├── lib/         api.js (fetch wrapper), utils.js
│       ├── pages/       route pages (+ co-located tests)
│       └── test/        test setup and helpers
├── server/          Express + Mongoose API
│   ├── src/
│   │   ├── config/      env (Zod-validated) and database connection
│   │   ├── controllers/ request handlers (thin: read input, call a service, send a response)
│   │   ├── middleware/  error handler, 404, validate, requireAuth, rate limiting
│   │   ├── models/      Mongoose models
│   │   ├── routes/      route definitions, mounted under /api
│   │   ├── services/    business logic
│   │   ├── utils/       AppError, password hashing, JWT, auth cookie helpers
│   │   ├── validation/  Zod request schemas
│   │   ├── app.js       builds the Express app (used by tests)
│   │   └── server.js    entry point: connects DB, listens, graceful shutdown
│   └── tests/       Supertest + Vitest API tests
└── compose.yaml     Docker Compose dev stack (mongo, server, client)
```

## Prerequisites

- Node.js 22+ (developed with Node 24) and npm
- Docker Desktop (for MongoDB and the containerized stack)

## Option A — Run everything with Docker (recommended)

```bash
docker compose up --build --watch
```

- App: http://localhost:5173
- API health check: http://localhost:5000/api/health

`--watch` turns on Compose Watch: edits in `client/src` and `server/src` are copied into the containers and hot-reloaded. Changing a `package.json` rebuilds that image.

Stop the stack with `Ctrl+C` or `docker compose down`. To also delete the database volume, run `docker compose down -v`. **This erases all local data.**

## Option B — Run the apps locally, with only MongoDB in Docker

```bash
# 1. Start MongoDB
docker compose up -d mongo

# 2. API (terminal 1)
cd server
cp .env.example .env
# Set JWT_SECRET in .env. Generate a value with:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
npm install
npm run dev

# 3. Client (terminal 2)
cd client
npm install
npm run dev
```

In development the Vite dev server proxies `/api/*` to the API, so the browser only talks to one origin. This lets cookies work without any cross-origin setup.

## Scripts

| Where    | Command              | What it does                         |
| -------- | -------------------- | ------------------------------------ |
| `server` | `npm run dev`        | Start the API with auto-restart (`node --watch`) |
| `server` | `npm start`          | Start the API without watching       |
| `server` | `npm test`           | Run API tests (Vitest + Supertest)   |
| `server` | `npm run lint`       | Lint with ESLint                     |
| `client` | `npm run dev`        | Start the Vite dev server            |
| `client` | `npm test`           | Run UI tests (Vitest + Testing Library) |
| `client` | `npm run lint`       | Lint with oxlint                     |
| `client` | `npm run build`      | Production build to `client/dist`    |

## Environment variables

Each app has a `.env.example` file. Copy it to `.env` (server) or `.env.local` (client). **Never commit real `.env` files.**

| Variable           | App    | Description |
| ------------------ | ------ | ----------- |
| `NODE_ENV`         | server | `development`, `test`, or `production` |
| `PORT`             | server | API port (default `5000`) |
| `MONGODB_URI`      | server | MongoDB connection string (**required**) |
| `CLIENT_URL`       | server | Frontend origin allowed by CORS |
| `DNS_SERVERS`      | server | Optional, comma-separated DNS IPs (e.g. `8.8.8.8,1.1.1.1`). See the troubleshooting section below. |
| `JWT_SECRET`       | server | **Required.** At least 32 random characters; signs session tokens. There is no default. `compose.yaml` contains a public, development-only placeholder. |
| `JWT_EXPIRES_IN`   | server | Session lifetime as a number plus `s`/`m`/`h`/`d` (default `7d`). Sets both the token expiry and the cookie `Max-Age`. |
| `COOKIE_NAME`      | server | Name of the HTTP-only session cookie (default `taskflow_session`) |
| `STORAGE_DRIVER`   | server | Where attachments are stored: `local` (development default), `s3` (**required in production**), or `memory` (tests only) |
| `UPLOAD_DIR`       | server | Folder for the `local` driver (default `uploads`, git-ignored) |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | server | Required when `STORAGE_DRIVER=s3`. Secrets: never commit them |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | server | Optional. Only for S3-compatible providers such as Cloudflare R2 or MinIO |
| `VITE_API_URL`     | client | API base URL used by the browser (default `/api`). Public, so no secrets. |
| `API_PROXY_TARGET` | client | Dev-server-only proxy target (default `http://localhost:5000`) |

The API validates its environment with Zod at startup. If a variable is missing or invalid, it exits with a clear message.

## Troubleshooting

**`querySrv ECONNREFUSED _mongodb._tcp...` when using MongoDB Atlas (`mongodb+srv://`)**

Your machine's DNS settings point Node at a DNS server that isn't answering, often `127.0.0.1`, left behind by a VPN or ad blocker. Node uses its own resolver for SRV records and doesn't fall back to another server. To fix it, add this to `server/.env`:

```
DNS_SERVERS=8.8.8.8,1.1.1.1
```

Alternatively, use the Atlas *standard* (`mongodb://host1,host2,host3/...`) connection string, which doesn't need SRV lookups.

## API

| Method | Path                 | Auth | Description |
| ------ | -------------------- | ---- | ----------- |
| GET    | `/api/health`        | –    | `200 { status: "ok", db: "connected" }`, or `503` when the database is down |
| POST   | `/api/auth/register` | –    | Body `{ name, email, password, confirmPassword }` → `201 { user }` and sets the session cookie. `400` invalid input, `409` email already in use |
| POST   | `/api/auth/login`    | –    | Body `{ email, password }` → `200 { user }` and sets the session cookie. `401 Invalid email or password` |
| POST   | `/api/auth/logout`   | –    | Clears the session cookie → `204` |
| GET    | `/api/auth/me`       | ✔    | `200 { user }`, or `401` if the cookie is missing, invalid, or expired, or the user was deleted |

`user` is always `{ id, name, email, createdAt, updatedAt }`. Password hashes and tokens are never returned in a response body.

Errors always use the shape `{ "error": { "message": "...", "details": [...]? } }`. Validation errors (`400`) include `details: [{ path, message }]`, one entry per invalid field.

### Tasks

All task endpoints require a signed-in user (`401` otherwise).

| Method | Path             | Description |
| ------ | ---------------- | ----------- |
| POST   | `/api/tasks`     | Create a task → `201 { task }`. The creator is always the signed-in user |
| GET    | `/api/tasks`     | List visible tasks → `200 { tasks, pagination: { page, limit, total, totalPages } }`, newest first |
| GET    | `/api/tasks/:id` | Get one task → `200 { task }`, where `task.statusHistory` lists status changes oldest first as `{ id, from, to, changedAt, changedBy: { id, name, email } }` |
| PATCH  | `/api/tasks/:id` | Update fields (at least one) → `200 { task }` |
| DELETE | `/api/tasks/:id` | Delete a task → `204` |

- **Fields:** `title` (required, ≤200), `description` (≤5000), `status` (`Idea`, `To Do`, `In Progress`, `In Review`, `Completed`; default `To Do`), `priority` (`Low`, `Medium`, `High`, `Critical`; default `Medium`), `assignee` (user id or `null`), `labels` (≤10, each ≤30 chars, de-duplicated), `dueDate` (`YYYY-MM-DD` or ISO timestamp, or `null`). A date-only value is stored as midnight UTC.
- **List query:** `page` (default 1), `limit` (default 20, max 100), `status`, `priority`, and `scope=created` (created by me) or `scope=assigned` (assigned to me).
- **Who can do what:** you can see a task only if you created it or it is assigned to you. Anything else returns `404`, the same as a task that doesn't exist. The creator can edit and delete. An assignee can change only `status` (other fields return `403`) and cannot delete (`403`). The assignee must be an existing user (`400` otherwise). `creator` can't be changed.
- `creator` and `assignee` come back as `{ id, name, email }`.
- **Status history:** an entry is written, inside the normal authorized update, only when a `PATCH` really changes the status (creating a task or sending the same status writes nothing). Entries are never edited, have no route of their own, and are deleted with the task. The detail page in the UI is at `/tasks/:id`; the Kanban board is at `/board`.

### Users (assignee picker)

| Method | Path         | Auth | Description |
| ------ | ------------ | ---- | ----------- |
| GET    | `/api/users` | ✔    | `200 { users: [{ id, name, email }] }`, sorted by name. `401` when signed out |

Query: `search` (optional, up to 100 characters, case-insensitive partial match on name or email) and `limit` (default 20, max 50). Only `id`, `name` and `email` are ever returned. Any signed-in user can list registered users, which is what lets them assign tasks to each other.

### Attachments

All attachment endpoints require a signed-in user who can see the task (anyone else gets `404`).

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET    | `/api/tasks/:id/attachments` | `200 { attachments }`, oldest first |
| POST   | `/api/tasks/:id/attachments` | Upload one file as `multipart/form-data` in the field `file` → `201 { attachment }` |
| GET    | `/api/tasks/:id/attachments/:attachmentId` | `200 { attachment }` (metadata) |
| GET    | `/api/tasks/:id/attachments/:attachmentId/download` | The file, always as a download (`Content-Disposition: attachment`, `nosniff`) |
| DELETE | `/api/tasks/:id/attachments/:attachmentId` | `204` |

`attachment` is `{ id, filename, mimeType, size, uploadedBy: { id, name, email }, createdAt }`. The storage location is never returned. `GET /api/tasks/:id` also includes `task.attachments`.

- **Who can do what:** the creator and the assignee can upload, list and download. The task creator can delete any attachment; everyone else can delete only files they uploaded themselves (`403` otherwise).
- **Limits:** 5 MB per file, 10 attachments per task. Allowed: `.png .jpg .jpeg .gif .webp .pdf .docx .xlsx .pptx .txt .csv .md`. SVG, HTML, scripts, archives and executables are rejected.
- **Validation:** the extension must be on the list **and** the file's real content must match it (checked from the file's bytes, not the browser's MIME type; text files must be valid UTF-8). Failures return `415` (type), `413` (size) or `400`.
- **Storage keys** look like `tasks/<taskId>/<random uuid>.<ext>` and are generated by the server. The user's filename only appears in the database (cleaned of paths and control characters) and in the download header.
- **Cleanup:** if the database write fails after storing, the stored object is removed again. Deleting an attachment or a task removes its objects too. If object storage is unreachable at that moment the row is still deleted and the leftover object is logged (a harmless orphan).

#### Setting up storage

- **Local development:** nothing to do. `STORAGE_DRIVER=local` writes to `server/uploads` (or the `uploads-data` volume in Docker).
- **Production (e.g. Render):** the server's disk is wiped on every deploy, so use an S3-compatible bucket and set `STORAGE_DRIVER=s3` plus the `S3_*` variables in the host's environment settings (never in Git). The API refuses to start in production with any other driver.
  1. Create a **private** bucket (AWS S3, or Cloudflare R2 for a free tier).
  2. Create an access key limited to that bucket with permission to read, write and delete objects.
  3. For R2 or MinIO also set `S3_ENDPOINT` (R2 uses region `auto`).
  4. No CORS setup is needed on the bucket, because the browser never talks to it.

### How sessions work

- On register or login, the API signs a JWT (HS256, `sub` = user id) and stores it in an **HTTP-only** cookie (`SameSite=Lax`, plus `Secure` in production). Browser JavaScript can't read it, and the browser sends it automatically.
- `requireAuth` middleware verifies the token, loads the user from MongoDB, and sets `req.user`. Identity always comes from the token, never from ids sent by the client.
- Passwords are hashed with bcrypt (cost 12). Max length is 72 bytes, because bcrypt ignores anything after that.
- Login and register are rate-limited per IP: 10 failed logins and 10 registrations per 15 minutes. Exceeding the limit returns `429`.
- Logout clears the cookie. Tokens are stateless, so a copied token stays valid until it expires. Server-side revocation can be added later if needed.
