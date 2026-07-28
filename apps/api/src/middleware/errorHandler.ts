import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../lib/apiError.js';
import { env } from '../config/env.js';

/**
 * Express 5 forwards rejected promises to the error handler on its own, but this
 * keeps the intent explicit and works identically if the version is ever pinned back.
 */
export function asyncHandler(
  handler: (...args: Parameters<RequestHandler>) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: `No route matches ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
  });
};

/** Single place where every failure becomes `{ error, code }`. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  // Body-parser rejects malformed JSON with a SyntaxError carrying `status`.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Request body is not valid JSON.', code: 'VALIDATION_ERROR' });
    return;
  }

  const e = err as { name?: string; message?: string; code?: number | string };

  if (e?.name === 'ValidationError') {
    res.status(400).json({ error: e.message, code: 'VALIDATION_ERROR' });
    return;
  }
  if (e?.name === 'CastError') {
    res.status(400).json({ error: 'Invalid id format.', code: 'VALIDATION_ERROR' });
    return;
  }
  // Mongo duplicate key
  if (e?.code === 11000) {
    res.status(409).json({ error: 'Resource already exists.', code: 'CONFLICT' });
    return;
  }

  console.error('[api] unhandled', err);
  res.status(500).json({
    error: 'Something went wrong on our end.',
    code: 'INTERNAL_ERROR',
    ...(env.isProduction ? {} : { detail: e?.message }),
  });
};
