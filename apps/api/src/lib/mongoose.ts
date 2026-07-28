import mongoose from 'mongoose';
import { env } from '../config/env.js';

/**
 * A serverless function is invoked concurrently and its module scope survives
 * between warm invocations, so the connection *promise* is cached on
 * `globalThis` rather than awaited per call. Without this, every invocation
 * opens its own connection and Atlas hits its connection cap under mild load.
 *
 * Caching is harmless for the long-lived server too: `index.ts` calls this once
 * at boot and the cache is simply never consulted again.
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
    // A function instance handles one request at a time, so a large pool is
    // wasted sockets multiplied by however many instances are warm.
    maxPoolSize: env.IS_SERVERLESS ? 5 : 10,
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
