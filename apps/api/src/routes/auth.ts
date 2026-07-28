import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { ApiError } from '../lib/apiError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, authUser } from '../middleware/auth.js';
import {
  extractBearerToken,
  signAccessToken,
  verifyAccessToken,
  TOKEN_TTL_SECONDS,
} from '../lib/jwt.js';

export const authRouter = Router();

/**
 * POST /api/auth/register — public.
 * Creates a company plus its first admin user.
 */
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password, companyName } = req.body ?? {};

    if (!name || !email || !password || !companyName) {
      throw new ApiError('VALIDATION_ERROR', 'name, email, password and companyName are all required.');
    }
    if (String(password).length < 6) {
      throw new ApiError('VALIDATION_ERROR', 'Password must be at least 6 characters.');
    }

    const normalizedEmail = String(email).toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) {
      throw new ApiError('CONFLICT', 'Email already registered.');
    }

    const company = await Company.create({ name: companyName, subscriptionPlan: 'free' });
    const user = await User.create({
      name,
      email: normalizedEmail,
      password: await bcrypt.hash(String(password), 12),
      role: 'admin',
      companyId: company._id,
    });

    res.status(201).json({
      message: 'Account created successfully',
      userId: user._id.toString(),
      companyId: company._id.toString(),
    });
  })
);

/**
 * POST /api/auth/token — public.
 * Exchanges email + password for a bearer token valid for exactly 1 day.
 */
authRouter.post(
  '/token',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      throw new ApiError('VALIDATION_ERROR', 'Email and password are required.');
    }

    const user = await User.findOne({ email: String(email).toLowerCase() }).lean();

    // Identical response for unknown email and wrong password, so the endpoint
    // can't be used to enumerate accounts.
    if (!user) throw new ApiError('INVALID_CREDENTIALS');
    if (!(await bcrypt.compare(String(password), user.password))) {
      throw new ApiError('INVALID_CREDENTIALS');
    }
    if (!user.companyId) {
      throw new ApiError('FORBIDDEN', 'This account is not linked to a company.');
    }

    const { token, expiresAt } = await signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId.toString(),
    });

    res.json({
      token,
      tokenType: 'Bearer',
      expiresIn: TOKEN_TTL_SECONDS,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId.toString(),
      },
    });
  })
);

/**
 * GET /api/auth/me
 * Identity plus how long the token has left. Flips to 401 TOKEN_EXPIRED on expiry.
 */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = authUser(req);

    let expiresAt: string | null = null;
    let secondsRemaining: number | null = null;

    const token = extractBearerToken(req.headers.authorization);
    if (token) {
      const verified = await verifyAccessToken(token);
      if (verified.valid && verified.claims.exp) {
        expiresAt = new Date(verified.claims.exp * 1000).toISOString();
        secondsRemaining = Math.max(0, verified.claims.exp - Math.floor(Date.now() / 1000));
      }
    }

    res.json({ user, authMethod: 'bearer', expiresAt, secondsRemaining });
  })
);
