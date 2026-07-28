import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './lib/mongoose.js';

/**
 * Long-lived server entry — used locally, by the Docker image, and by pm2 on a
 * VPS. Vercel does not run this file; it uses `serverless.ts` instead, because a
 * function invocation has no port to bind.
 */
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
