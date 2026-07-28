/**
 * Central environment config. Validated once at boot so a misconfigured VPS
 * fails immediately with a clear message instead of throwing on first request.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See apps/api/.env.example.`
    );
  }
  return value;
}

const NODE_ENV = process.env.NODE_ENV || 'development';

export const env = {
  NODE_ENV,
  isProduction: NODE_ENV === 'production',
  isStaging: process.env.APP_ENV === 'staging',
  /** Free-form label surfaced on /health so you can tell staging from prod at a glance. */
  APP_ENV: process.env.APP_ENV || NODE_ENV,

  PORT: Number(process.env.PORT || 4000),
  MONGODB_URI: required('MONGODB_URI'),
  JWT_SECRET: required('JWT_SECRET'),

  /**
   * Comma-separated list of browser origins allowed to call this API.
   * Must include the Vercel deployment URL, e.g.
   *   CORS_ORIGINS=https://crm.example.com,https://crm-staging.vercel.app
   */
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  /** Token lifetime in seconds. Defaults to exactly 1 day. */
  TOKEN_TTL_SECONDS: Number(process.env.TOKEN_TTL_SECONDS || 60 * 60 * 24),
} as const;
