/**
 * An expected, "operational" error whose message is safe to show to the client
 * (e.g. 404 Not Found, 403 Forbidden). Anything else is treated as a 500.
 */
export class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}
