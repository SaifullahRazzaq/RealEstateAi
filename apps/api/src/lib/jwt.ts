import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../config/env.js';

export const TOKEN_TTL_SECONDS = env.TOKEN_TTL_SECONDS;

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = 'real-estate-crm';

export interface AccessTokenClaims extends JWTPayload {
  sub: string; // user id
  email: string;
  name: string;
  role: string;
  companyId: string;
}

/** The claims a caller supplies; `iat`/`exp`/`iss` are stamped by signAccessToken. */
export interface AccessTokenInput {
  sub: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
}

export async function signAccessToken(
  claims: AccessTokenInput
): Promise<{ token: string; expiresAt: Date }> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + TOKEN_TTL_SECONDS;

  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setSubject(claims.sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secret);

  return { token, expiresAt: new Date(expiresAt * 1000) };
}

export type VerifyResult =
  | { valid: true; claims: AccessTokenClaims }
  | { valid: false; reason: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' };

export async function verifyAccessToken(token: string): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
    return { valid: true, claims: payload as AccessTokenClaims };
  } catch (err) {
    // jose throws ERR_JWT_EXPIRED specifically once past `exp`.
    const code = (err as { code?: string })?.code;
    if (code === 'ERR_JWT_EXPIRED') return { valid: false, reason: 'TOKEN_EXPIRED' };
    return { valid: false, reason: 'TOKEN_INVALID' };
  }
}

/** Pulls the raw token out of an `Authorization: Bearer <token>` header. */
export function extractBearerToken(header?: string): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}
