import type { IncomingMessage, ServerResponse } from 'node:http';

import { app } from './app.js';
import { connectDB } from './lib/mongoose.js';

/**
 * Vercel entry point. A function invocation gets one request and no port, so
 * instead of `app.listen()` the Express app is called directly as the request
 * handler it already is.
 *
 * The DB connection is established before delegating because a cold instance
 * would otherwise run queries against a disconnected mongoose. `connectDB`
 * caches its promise, so on a warm instance this awaits an already-resolved
 * value and costs nothing.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await connectDB();
  } catch (err) {
    // Never let a DB outage surface as an opaque function crash — the frontend
    // parses `{ error, code }` and would otherwise show nothing useful.
    console.error('[api] mongo connect failed:', err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database unavailable.', code: 'DB_UNAVAILABLE' }));
    return;
  }

  app(req as never, res as never);
}
