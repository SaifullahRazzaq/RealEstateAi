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

/**
 * helmet's package.json maps `import` to index.mjs and `require` to index.cjs
 * but declares no `types` condition for either. Toolchains that pick a different
 * one than tsc does hand back the module namespace instead of the callable
 * default, and calling it fails with "This expression is not callable" — which
 * is what Vercel's build reports even though `npm ci` plus tsc resolves it
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

/**
 * The Express app, built with no listening socket of its own so that binding a
 * port stays the sole job of `server.ts`.
 */
export const app = express();

// Behind a proxy in every deployment (nginx on a VPS, Vercel's edge in front of
// a function), so client IPs and protocol come from headers.
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
 * Every route below needs mongoose connected, and `server.ts` cannot await that
 * before listening without breaking Vercel's server detection — so the wait
 * happens here, against the promise `connectDB` caches. On a warm process this
 * resolves immediately.
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

app.use(notFoundHandler);
app.use(errorHandler);
