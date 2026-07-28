import { Router } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../lib/apiError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, authUser } from '../middleware/auth.js';
import { signAccessToken, verifyAccessToken } from '../lib/jwt.js';
import {
  buildConsentUrl,
  completeConnection,
  disconnect,
  googleConfigured,
  isConnected,
} from '../lib/google.js';

export const integrationsRouter = Router();

/** GET /api/integrations/google/status */
integrationsRouter.get(
  '/google/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    res.json({
      configured: googleConfigured,
      connected: googleConfigured ? await isConnected(user.id) : false,
    });
  })
);

/**
 * GET /api/integrations/google/connect
 * Returns the consent URL for the browser to open.
 *
 * Google redirects back to this server, not the SPA, and that redirect carries
 * no Authorization header — so the caller's identity rides along in `state` as a
 * short-lived signed token rather than being trusted from a query param.
 */
integrationsRouter.get(
  '/google/connect',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    if (!googleConfigured) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Google Calendar is not configured on this server. See apps/api/.env.example.'
      );
    }

    const { token: state } = await signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    });

    res.json({ url: buildConsentUrl(state) });
  })
);

/**
 * GET /api/integrations/google/callback
 * Google sends the browser here. Ends with a redirect back into the app.
 */
integrationsRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : null;
    const state = typeof req.query.state === 'string' ? req.query.state : null;
    const settings = `${env.WEB_APP_URL}/dashboard/settings`;

    if (req.query.error || !code || !state) {
      res.redirect(`${settings}?google=denied`);
      return;
    }

    const verified = await verifyAccessToken(state);
    if (!verified.valid) {
      res.redirect(`${settings}?google=expired`);
      return;
    }

    try {
      const email = await completeConnection(code, verified.claims.sub);
      res.redirect(`${settings}?google=connected&account=${encodeURIComponent(email || '')}`);
    } catch (err) {
      console.error('[api] google callback failed:', err);
      res.redirect(`${settings}?google=failed`);
    }
  })
);

/** DELETE /api/integrations/google */
integrationsRouter.delete(
  '/google',
  requireAuth,
  asyncHandler(async (req, res) => {
    await disconnect(authUser(req).id);
    res.json({ message: 'Google account disconnected' });
  })
);
