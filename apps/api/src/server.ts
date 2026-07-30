import express from 'express';
import type { RequestHandler } from 'express';
import cors from 'cors';
import helmetImport from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { connectDB } from './lib/mongoose.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import { authRouter } from './routes/auth.js';
import { leadsRouter } from './routes/leads.js';
import { scheduleRouter } from './routes/schedule.js';
import { usersRouter } from './routes/users.js';
import { dashboardRouter } from './routes/dashboard.js';
import { reportsRouter } from './routes/reports.js';
import { notificationsRouter } from './routes/notifications.js';
import { integrationsRouter } from './routes/integrations.js';
import { aiRouter } from './routes/ai.js';
import { propertiesRouter } from './routes/properties.js';

/**
 * The one entry point, for every target: local dev, the Docker image, pm2 on a
 * VPS, and Vercel.
 *
 * App construction lives in this file rather than a separate module because
 * Vercel's Express preset looks for an entrypoint that imports `express`
 * directly — with the app built elsewhere it reports "No entrypoint found which
 * imports express". Two earlier layouts failed here for related reasons, so the
 * rule to remember is that this file must both import express and call listen():
 *
 *   - a module named `src/app.{js,ts}` is picked up as a function entrypoint and
 *     rejected for exporting an app where a handler belongs
 *   - an entrypoint that only re-exports an app built elsewhere is not detected
 */

/**
 * helmet's package.json maps `import` to index.mjs and `require` to index.cjs
 * but declares no `types` condition for either. Toolchains that pick a different
 * one than tsc does hand back the module namespace instead of the callable
 * default, and calling it fails with "This expression is not callable" — which
 * is what Vercel's build reported even though `npm ci` plus tsc resolves it
 * correctly locally, in a clean clone, and in the Docker image.
 *
 * So unwrap a nested default if one is present and state the shape this file
 * actually uses. On every toolchain that already resolved it correctly the
 * fallback is what runs and behaviour is unchanged.
 */
const helmet = ((helmetImport as unknown as { default?: unknown }).default ??
  helmetImport) as () => RequestHandler;

/**
 * Turns a CORS_ORIGINS entry into a matcher. Plain entries compare exactly;
 * entries containing `*` become an anchored regex where the wildcard stands in
 * for one or more subdomain labels (`https://*.vercel.app` matches
 * `https://crm-git-main-acme.vercel.app` but never `https://evil.com`).
 */
function originMatcher(pattern: string): (origin: string) => boolean {
  if (!pattern.includes('*')) return (origin) => origin === pattern;

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+(?:\\.[^.]+)*');
  const re = new RegExp(`^${escaped}$`);
  return (origin) => re.test(origin);
}

const allowedOrigin = (() => {
  const matchers = env.CORS_ORIGINS.map(originMatcher);
  return (origin: string) => matchers.some((match) => match(origin));
})();

const app = express();

// Behind a proxy in every deployment (nginx on a VPS, Vercel's edge in front of
// the captured server), so client IPs and protocol come from headers.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Server-to-server calls and curl send no Origin — always allow those.
      if (!origin) return callback(null, true);
      if (allowedOrigin(origin)) return callback(null, true);

      // Deny by omitting the header rather than throwing: the browser blocks the
      // response itself, and an unknown origin shouldn't surface as a 500.
      // CORS is not the authorisation boundary here — the bearer token is.
      console.warn(`[api] CORS: rejected origin ${origin}`);
      callback(null, false);
    },
    // The API is pure Bearer-token; no cookies cross the boundary.
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

/** Liveness probe — also tells you which environment answered. */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: env.APP_ENV,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Every route below needs mongoose connected, and `listen()` cannot wait for
 * that without breaking Vercel's server detection — so the wait happens here,
 * against the promise `connectDB` caches. On a warm process it resolves
 * immediately.
 *
 * Registered after /health deliberately: a liveness probe that fails whenever
 * the database is unreachable cannot tell you which of the two is broken.
 */
app.use((_req, res, next) => {
  connectDB().then(
    () => next(),
    (err: Error) => {
      console.error('[api] mongo connect failed:', err.message);
      res.status(503).json({ error: 'Database unavailable.', code: 'DB_UNAVAILABLE' });
    }
  );
});

app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/properties', propertiesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Started here but awaited per request above: Vercel captures the HTTP server
 * from a *synchronous* listen() during module startup, so nothing may block it.
 * Starting eagerly still pays off on a long-lived process — the handshake
 * overlaps with boot instead of delaying the first request.
 */
void connectDB().then(
  () => console.log('[api] mongo connected'),
  (err: Error) => console.error('[api] mongo connect failed at startup:', err.message)
);

app.listen(env.PORT, () => {
  console.log(`[api] ${env.APP_ENV} listening on :${env.PORT}`);
  console.log(`[api] CORS origins: ${env.CORS_ORIGINS.join(', ')}`);
});
