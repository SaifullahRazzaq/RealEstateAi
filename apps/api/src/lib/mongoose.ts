import mongoose from 'mongoose';
import { env } from '../config/env.js';

/**
 * `app.ts` calls this on every request, so it has to be idempotent: the
 * connection *promise* is cached and re-awaited rather than a new connection
 * opened. It lives on `globalThis` so a reloaded module — dev watch mode, or a
 * platform that re-evaluates the entry — reuses the existing connection instead
 * of leaking one per reload.
 */
declare global {
  // eslint-disable-next-line no-var
  var __crmMongoose: Promise<typeof mongoose> | undefined;
}

function openConnection(): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err) => {
    console.error('[api] mongo error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[api] mongo disconnected');
  });

  return mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
}

export async function connectDB() {
  if (!global.__crmMongoose) {
    global.__crmMongoose = openConnection().catch((err) => {
      // Drop the rejected promise so the next invocation retries instead of
      // replaying the same failure for the life of the instance.
      global.__crmMongoose = undefined;
      throw err;
    });
  }

  return global.__crmMongoose;
}

export async function disconnectDB() {
  global.__crmMongoose = undefined;
  await mongoose.disconnect();
}
