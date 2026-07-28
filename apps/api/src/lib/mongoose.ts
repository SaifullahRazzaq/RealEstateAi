import mongoose from 'mongoose';
import { env } from '../config/env.js';

/**
 * The API is a long-lived process, so one connection at boot is all it needs —
 * no global caching dance like the serverless version required.
 */
export async function connectDB() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err) => {
    console.error('[api] mongo error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[api] mongo disconnected');
  });

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
