import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { createApiRouter } from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Builds the Express app without starting a server or connecting to MongoDB,
 * so tests can import it directly with Supertest.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Trust this many proxies in front of the API (see TRUST_PROXY_HOPS in config/env.js) so req.ip is the real client.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true, // allow the browser to send our auth cookie
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser()); // fills req.cookies; must run before any route that reads the session

  app.use('/api', createApiRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
