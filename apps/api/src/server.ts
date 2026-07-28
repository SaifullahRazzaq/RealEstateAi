import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './lib/mongoose.js';

/**
 * The one entry point, for every target: local dev, the Docker image, pm2 on a
 * VPS, and Vercel.
 *
 * Vercel discovers this file by name (`src/server.ts`) and captures the HTTP
 * server from the `listen()` call, routing requests to it over an internal port
 * — the port below only takes effect when the process is run directly.
 *
 * That detection reads the *synchronous* `listen()` during module startup, so
 * the connection is started here but awaited per request in `app.ts`. Starting
 * it eagerly still pays off on a long-lived process: the handshake overlaps
 * with boot instead of delaying the first request.
 */
void connectDB().then(
  () => console.log('[api] mongo connected'),
  (err) => console.error('[api] mongo connect failed at startup:', err.message)
);

app.listen(env.PORT, () => {
  console.log(`[api] ${env.APP_ENV} listening on :${env.PORT}`);
  console.log(`[api] CORS origins: ${env.CORS_ORIGINS.join(', ')}`);
});
