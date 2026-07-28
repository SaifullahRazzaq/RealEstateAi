import { getToken, clearToken } from './token';

/**
 * Base URL of the Express API on the VPS.
 * Set NEXT_PUBLIC_API_URL per environment in Vercel; it must be an absolute
 * https:// origin in production or the browser will block the request as mixed content.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export interface ApiErrorShape {
  error: string;
  code: string;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

/** Fired when the API rejects our token, so the app can bounce to the login page. */
export const AUTH_EXPIRED_EVENT = 'crm:auth-expired';

function notifyAuthExpired() {
  clearToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Skip attaching the Authorization header (login/register). */
  anonymous?: boolean;
};

/**
 * Single entry point for talking to the API. Attaches the bearer token,
 * normalises the `{ error, code }` failure shape, and logs the user out on
 * any 401 so an expired token can never leave the UI in a half-broken state.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (!anonymous) {
    const token = getToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    // Let the browser set the multipart boundary itself.
    payload = body;
  } else if (body !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers: finalHeaders, body: payload });

  if (res.status === 401 && !anonymous) {
    notifyAuthExpired();
  }

  if (!res.ok) {
    let code = 'INTERNAL_ERROR';
    let message = `Request failed with status ${res.status}`;
    try {
      const data = (await res.json()) as ApiErrorShape;
      code = data.code || code;
      message = data.error || message;
    } catch {
      /* non-JSON error body — keep the defaults */
    }
    throw new ApiRequestError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** For endpoints that stream a file back rather than JSON (xlsx export). */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (res.status === 401) notifyAuthExpired();
  if (!res.ok) throw new ApiRequestError(res.status, 'INTERNAL_ERROR', 'Export failed');
  return res.blob();
}
