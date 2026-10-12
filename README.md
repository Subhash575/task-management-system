# TaskFlow — Jira-style Task Management System

A MERN-stack (MongoDB, Express, React, Node.js) task manager with a Kanban board, built incrementally.

> **Status:** project scaffold only. Auth, tasks, Kanban, attachments, and the dashboard are not implemented yet.

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
│   │   ├── controllers/ request handlers
│   │   ├── middleware/  404 + centralized error handler
│   │   ├── routes/      route definitions, mounted under /api
│   │   ├── utils/       AppError, helpers
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

| Method | Path          | Description |
| ------ | ------------- | ----------- |
| GET    | `/api/health` | `200 { status: "ok", db: "connected" }`, or `503` when the database is down |

Errors always use the shape `{ "error": { "message": "...", "details": [...]? } }`.
