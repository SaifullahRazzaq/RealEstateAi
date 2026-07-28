import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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

const app = express();

// Behind nginx/Caddy on the VPS, so client IPs and protocol come from headers.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Server-to-server calls and curl send no Origin — always allow those.
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);

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

app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  // Connect before listening so the first request never races the DB handshake.
  await connectDB();
  console.log(`[api] mongo connected`);

  app.listen(env.PORT, () => {
    console.log(`[api] ${env.APP_ENV} listening on :${env.PORT}`);
    console.log(`[api] CORS origins: ${env.CORS_ORIGINS.join(', ')}`);
  });
}

start().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
