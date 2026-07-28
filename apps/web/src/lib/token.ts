/**
 * Token storage.
 *
 * The token lives in a cookie rather than localStorage for one reason: `proxy.ts`
 * runs on the server and can only see cookies, so this is what lets the dashboard
 * be guarded before a page is ever rendered.
 *
 * It is deliberately NOT httpOnly — client code has to read it to build the
 * `Authorization` header. That means it carries the same XSS exposure as
 * localStorage would; the real authorisation boundary is the API, which verifies
 * the signature on every request.
 */

export const TOKEN_COOKIE = 'crm_token';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
}

export function setToken(token: string, expiresAt: string) {
  const expires = new Date(expiresAt).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${TOKEN_COOKIE}=${token}; Path=/; Expires=${expires}; SameSite=Lax${secure}`;
}

export function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearToken() {
  document.cookie = `${TOKEN_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  exp: number;
}

/**
 * Reads the claims without verifying the signature — safe here because this only
 * drives UI (which name to show, when to log out). Anything that matters is
 * re-verified by the API.
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function userFromToken(token: string): StoredUser | null {
  const claims = decodeToken(token);
  if (!claims) return null;
  return {
    id: claims.sub,
    name: claims.name,
    email: claims.email,
    role: claims.role,
    companyId: claims.companyId,
  };
}

export function isExpired(token: string): boolean {
  const claims = decodeToken(token);
  if (!claims?.exp) return true;
  return claims.exp * 1000 <= Date.now();
}

/** Milliseconds until the token expires; 0 if already expired or unreadable. */
export function msUntilExpiry(token: string): number {
  const claims = decodeToken(token);
  if (!claims?.exp) return 0;
  return Math.max(0, claims.exp * 1000 - Date.now());
}
