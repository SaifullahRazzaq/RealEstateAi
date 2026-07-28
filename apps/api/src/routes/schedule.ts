import { Router } from 'express';
import { Schedule } from '../models/Schedule.js';
import { Lead } from '../models/Lead.js';
import { ApiError } from '../lib/apiError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, authUser } from '../middleware/auth.js';

export const scheduleRouter = Router();
scheduleRouter.use(requireAuth);

/** Express 5 types route params as string | string[]; routes always want the single value. */
const param = (v: unknown): string => (Array.isArray(v) ? v[0] : String(v ?? ''));

const qs = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** GET /api/schedule — filter by lead, status, upcoming scope or a date range. */
scheduleRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = authUser(req);

    const leadId = qs(req.query.leadId);
    const start = qs(req.query.start);
    const end = qs(req.query.end);
    const status = qs(req.query.status);
    const scopeFilter = qs(req.query.scope); // 'upcoming' | 'all'

    const query: Record<string, unknown> = { companyId: user.companyId };
    if (user.role === 'agent') query.userId = user.id;
    if (leadId) query.leadId = leadId;
    if (status) query.status = status;
    if (scopeFilter === 'upcoming') {
      query.status = 'scheduled';
      query.scheduledAt = { $gte: new Date() };
    }
    if (start && end) {
      query.scheduledAt = {
        $gte: new Date(start),
        $lte: new Date(new Date(end).setHours(23, 59, 59, 999)),
      };
    }

    const schedules = await Schedule.find(query)
      .populate('leadId', 'name company phone status')
      .populate('userId', 'name')
      .sort({ scheduledAt: 1 })
      .lean();

    res.json({ schedules });
  })
);

/** POST /api/schedule — book a meeting, call or follow-up against a lead. */
scheduleRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const { leadId, type, title, scheduledAt, durationMins, location, notes } = req.body ?? {};

    if (!leadId || !title || !scheduledAt) {
      throw new ApiError('VALIDATION_ERROR', 'leadId, title and scheduledAt are required.');
    }

    // Ensure the lead belongs to this tenant.
    const lead = await Lead.findOne({ _id: leadId, companyId: user.companyId });
    if (!lead) throw new ApiError('NOT_FOUND', 'Lead not found.');

    const schedule = await Schedule.create({
      leadId,
      userId: user.id,
      companyId: user.companyId,
      type: type || 'meeting',
      title,
      scheduledAt: new Date(scheduledAt),
      durationMins: durationMins || 30,
      location,
      notes,
      status: 'scheduled',
    });

    // Reflect on the lead so it surfaces in the Meeting tab.
    if ((type || 'meeting') === 'meeting') {
      lead.meetingDate = new Date(scheduledAt);
      if (lead.status !== 'won' && lead.status !== 'lost') lead.status = 'meeting';
      await lead.save();
    }

    const populated = await schedule.populate('leadId', 'name company phone');
    res.status(201).json({ schedule: populated });
  })
);

/** PATCH /api/schedule/:id */
scheduleRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const body = req.body ?? {};

    const allowed: Record<string, unknown> = {};
    for (const key of ['title', 'type', 'scheduledAt', 'durationMins', 'location', 'notes', 'status']) {
      if (body[key] !== undefined) allowed[key] = body[key];
    }
    if (allowed.scheduledAt) allowed.scheduledAt = new Date(allowed.scheduledAt as string);

    const schedule = await Schedule.findOneAndUpdate(
      { _id: param(req.params.id), companyId: user.companyId },
      { $set: allowed },
      { returnDocument: 'after' }
    )
      .populate('leadId', 'name company phone')
      .lean();

    if (!schedule) throw new ApiError('NOT_FOUND', 'Schedule not found.');
    res.json({ schedule });
  })
);

/** DELETE /api/schedule/:id */
scheduleRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    await Schedule.findOneAndDelete({ _id: param(req.params.id), companyId: user.companyId });
    res.json({ message: 'Schedule deleted' });
  })
);
