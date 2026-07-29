/**
 * Central environment config. Validated once at boot so a misconfigured VPS
 * fails immediately with a clear message instead of throwing on first request.
 */

/**
 * Collects every missing variable before throwing rather than failing on the
 * first. On a host that surfaces a module-load crash as an opaque 500 — Vercel
 * reports `FUNCTION_INVOCATION_FAILED` — one round trip per missing variable is
 * an expensive way to learn what the config needs.
 */
const missing: string[] = [];

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    missing.push(name);
    return '';
  }
  return value;
}

function assertConfigured() {
  if (missing.length === 0) return;
  throw new Error(
    `Missing required environment variable${missing.length > 1 ? 's' : ''}: ` +
      `${missing.join(', ')}. Set ${missing.length > 1 ? 'them' : 'it'} on the host ` +
      `(Vercel: Project Settings -> Environment Variables) — see apps/api/.env.example.`
  );
}

const NODE_ENV = process.env.NODE_ENV || 'development';

export const env = {
  NODE_ENV,
  isProduction: NODE_ENV === 'production',
  isStaging: process.env.APP_ENV === 'staging',
  /** Free-form label surfaced on /health so you can tell staging from prod at a glance. */
  APP_ENV: process.env.APP_ENV || NODE_ENV,

  /** On Vercel this only names the internal port it routes to. */
  PORT: Number(process.env.PORT || 4000),
  MONGODB_URI: required('MONGODB_URI'),
  JWT_SECRET: required('JWT_SECRET'),

  /**
   * Comma-separated list of browser origins allowed to call this API.
   * Must include the Vercel deployment URL, e.g.
   *   CORS_ORIGINS=https://crm.example.com,https://crm-staging.vercel.app
   *
   * An entry may use `*` as a wildcard for one or more subdomain labels, which
   * is what makes Vercel preview deployments usable — every branch gets a fresh
   * hostname, so listing them individually is impossible:
   *   CORS_ORIGINS=https://*.vercel.app
   */
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  /** Token lifetime in seconds. Defaults to exactly 1 day. */
  TOKEN_TTL_SECONDS: Number(process.env.TOKEN_TTL_SECONDS || 60 * 60 * 24),

  /**
   * Google Calendar OAuth — needed to create real Meet links.
   * Optional: when unset, meetings still work with a manually pasted link.
   */
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',

  /** Where to bounce the browser after the Google consent screen. */
  WEB_APP_URL: process.env.WEB_APP_URL || 'http://localhost:3000',
} as const;

assertConfigured();
