import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Convert known error types into an AppError so every response has the same shape:
 *   { error: { message, details? } }
 */
function normalizeError(err) {
  if (err instanceof AppError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return new AppError(400, 'Validation failed', details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return new AppError(400, `Invalid value for ${err.path}`);
  }

  // Malformed JSON body (thrown by express.json()) or payload too large.
  if (err.type === 'entity.parse.failed') return new AppError(400, 'Malformed JSON body');
  if (err.type === 'entity.too.large') return new AppError(413, 'Request body too large');

  return null;
}

// Express recognises error handlers by their 4 arguments, so `_next` must stay.
export function errorHandler(err, req, res, _next) {
  const known = normalizeError(err);
  const statusCode = known?.statusCode ?? 500;

  // Unexpected errors are logged on the server, but their message is hidden from the client.
  if (!known) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  const body = {
    error: {
      message: known ? known.message : 'Internal server error',
      ...(known?.details && { details: known.details }),
      ...(env.isDevelopment && !known && { stack: err.stack }),
    },
  };

  res.status(statusCode).json(body);
}
