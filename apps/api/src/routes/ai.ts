import { Router } from 'express';

import { Lead } from '../models/Lead.js';
import { notFound } from '../lib/apiError.js';
import { leadScope } from '../lib/scope.js';
import { aiConfigured } from '../lib/ai.js';
import { scoreLead } from '../services/leadScoring.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, authUser } from '../middleware/auth.js';

export const aiRouter = Router();
aiRouter.use(requireAuth);

/** Express 5 types route params as string | string[]; routes always want the single value. */
const param = (v: unknown): string => (Array.isArray(v) ? v[0] : String(v ?? ''));

/**
 * GET /api/ai/status — lets the frontend hide AI controls instead of showing
 * buttons that will only ever error on a deployment without a key.
 */
aiRouter.get('/status', (_req, res) => {
  res.json({ configured: aiConfigured() });
});

/**
 * POST /api/ai/leads/:id/score — score one lead and cache the result on it.
 *
 * Scoped through `leadScope` like every other lead lookup: an agent must not be
 * able to score — and so read the notes of — someone else's lead just by id.
 */
aiRouter.post(
  '/leads/:id/score',
  asyncHandler(async (req, res) => {
    const user = authUser(req);

    const lead = await Lead.findOne({ _id: param(req.params.id), ...leadScope(user) });
    if (!lead) throw notFound('Lead not found.');

    const result = await scoreLead(lead);

    lead.ai = { ...result, scoredAt: new Date() };
    await lead.save();

    res.json(lead.ai);
  })
);
