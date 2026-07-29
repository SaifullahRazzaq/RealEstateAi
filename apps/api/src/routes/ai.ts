import { Router } from 'express';

import { Lead } from '../models/Lead.js';
import { ScoreBatch } from '../models/ScoreBatch.js';
import { badRequest, notFound } from '../lib/apiError.js';
import { leadScope } from '../lib/scope.js';
import { aiConfigured, getBatchStatus, readBatchResults } from '../lib/ai.js';
import { scoreLead, scoreLeadsBatch, type LeadScore } from '../services/leadScoring.js';
import { summarizeLead } from '../services/leadSummary.js';
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

/**
 * POST /api/ai/leads/:id/summary — brief the agent on this lead.
 *
 * Deliberately not persisted, unlike the score. A score is read off a list to
 * decide what to work on, so it has to survive the request; a brief is read in
 * the seconds before a call and must reflect the note added a minute ago. A
 * cached brief would quietly show yesterday's picture at exactly the moment
 * being current matters most.
 */
aiRouter.post(
  '/leads/:id/summary',
  asyncHandler(async (req, res) => {
    const user = authUser(req);

    const lead = await Lead.findOne({ _id: param(req.params.id), ...leadScope(user) });
    if (!lead) throw notFound('Lead not found.');

    res.json(await summarizeLead(lead));
  })
);

/** One run is capped so a mis-click can't submit a whole database for scoring. */
const MAX_BATCH = 200;

/**
 * POST /api/ai/leads/score-batch — score every unscored lead the caller can see.
 *
 * Returns as soon as the batch is submitted; the work happens on Anthropic's
 * side. Scoring a hundred leads in-request would blow any serverless function
 * timeout, and batching also bills at half rate — which is exactly the tradeoff
 * a run-over-everything job should take, since nobody is waiting on it live.
 */
aiRouter.post(
  '/leads/score-batch',
  asyncHandler(async (req, res) => {
    const user = authUser(req);

    // Only leads that have never been scored, so re-running is cheap and safe.
    const leads = await Lead.find({ ...leadScope(user), ai: { $exists: false } }).limit(MAX_BATCH);
    if (leads.length === 0) throw badRequest('Every lead you can see has already been scored.');

    const batchId = await scoreLeadsBatch(leads);

    const batch = await ScoreBatch.create({
      companyId: user.companyId,
      requestedBy: user.id,
      batchId,
      total: leads.length,
    });

    res.status(202).json({ id: batch.id, total: batch.total, ended: false });
  })
);

/**
 * GET /api/ai/batches/:id — poll a run, and write the scores once it's done.
 *
 * Applying results here rather than in a background worker is what keeps this
 * working on a serverless host: there is no process to do it later, so the
 * first poll that observes the batch ended does the writing. `appliedAt` makes
 * that idempotent when two polls race.
 */
aiRouter.get(
  '/batches/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);

    const batch = await ScoreBatch.findOne({ _id: param(req.params.id), companyId: user.companyId });
    if (!batch) throw notFound('Scoring run not found.');

    if (batch.appliedAt) {
      res.json({ id: batch.id, total: batch.total, ended: true, ...batch.applied });
      return;
    }

    const status = await getBatchStatus(batch.batchId);
    if (!status.ended) {
      res.json({ id: batch.id, total: batch.total, ended: false, pending: status.counts.processing });
      return;
    }

    // Claim the batch before reading results so a concurrent poll doesn't
    // apply the same scores twice.
    const claimed = await ScoreBatch.findOneAndUpdate(
      { _id: batch._id, appliedAt: { $exists: false } },
      { $set: { appliedAt: new Date() } }
    );
    if (!claimed) {
      const fresh = await ScoreBatch.findById(batch._id);
      res.json({ id: batch.id, total: batch.total, ended: true, ...fresh?.applied });
      return;
    }

    let scored = 0;
    let failed = 0;
    for await (const result of readBatchResults<LeadScore>(batch.batchId)) {
      if (!result.value) {
        failed += 1;
        continue;
      }
      // Re-apply the tenant scope on write: the batch was built from scoped
      // leads, but the id round-tripped through an external service.
      const updated = await Lead.updateOne(
        { _id: result.customId, companyId: user.companyId },
        { $set: { ai: { ...result.value, scoredAt: new Date() } } }
      );
      if (updated.matchedCount === 1) scored += 1;
      else failed += 1;
    }

    // updateOne rather than claimed.save(): findOneAndUpdate returned the
    // pre-update document, so saving it risks writing appliedAt back to unset
    // and letting a later poll re-apply the whole batch.
    await ScoreBatch.updateOne({ _id: batch._id }, { $set: { applied: { scored, failed } } });

    res.json({ id: batch.id, total: batch.total, ended: true, scored, failed });
  })
);
