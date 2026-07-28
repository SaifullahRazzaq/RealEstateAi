import type { RequestHandler } from 'express';
import { ApiError } from '../lib/apiError.js';
import { extractBearerToken, verifyAccessToken } from '../lib/jwt.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Bearer-token gate. The API is stateless — there are no sessions or cookies,
 * so every protected route resolves its caller from the Authorization header.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) throw new ApiError('NO_TOKEN');

    const result = await verifyAccessToken(token);
    if (!result.valid) throw new ApiError(result.reason);

    const { claims } = result;
    if (!claims.companyId) {
      throw new ApiError('FORBIDDEN', 'This account is not linked to a company.');
    }

    req.user = {
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      role: claims.role,
      companyId: claims.companyId,
    };
    next();
  } catch (err) {
    next(err);
  }
};

/** Must be mounted after requireAuth. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'admin') {
    next(new ApiError('FORBIDDEN', 'Admin role required.'));
    return;
  }
  next();
};

/** Narrowing helper so routes can use `req.user` without repeating the check. */
export function authUser(req: { user?: AuthUser }): AuthUser {
  if (!req.user) throw new ApiError('NO_TOKEN');
  return req.user;
}
