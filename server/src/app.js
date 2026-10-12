import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Builds the Express app without starting a server or connecting to MongoDB,
 * so tests can import it directly with Supertest.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Trust the first proxy (Docker/nginx/load balancer) so req.ip and secure cookies work.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true, // allow the browser to send our auth cookie (added in the auth task)
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
