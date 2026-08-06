import { Router } from 'express';
import { Schedule, type MeetingProvider, type MeetingOutcome } from '../models/Schedule.js';
import { Lead, type LeadStatus } from '../models/Lead.js';
import { ApiError } from '../lib/apiError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, authUser } from '../middleware/auth.js';
import { leadScope, ownedScope } from '../lib/scope.js';
import { createMeetEvent, updateMeetEvent } from '../lib/google.js';

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

    const query: Record<string, unknown> = { ...ownedScope(user) };
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

/** POST /api/schedule — book the lead's next dated commitment. */
scheduleRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const {
      leadId, title, scheduledAt, durationMins, location, notes,
      provider, meetingLink, attendees,
    } = req.body ?? {};

    if (!leadId || !title || !scheduledAt) {
      throw new ApiError('VALIDATION_ERROR', 'leadId, title and scheduledAt are required.');
    }

    // Must be a lead the caller actually owns, not merely one in their company.
    const lead = await Lead.findOne({ _id: leadId, ...leadScope(user) });
    if (!lead) throw new ApiError('NOT_FOUND', 'Lead not found.');

    const startsAt = new Date(scheduledAt);
    const duration = durationMins || 30;
    const chosenProvider: MeetingProvider = provider || 'in_person';

    // Invite the lead by default so they receive the calendar invite.
    const invitees: string[] = Array.isArray(attendees)
      ? attendees.filter(Boolean)
      : [lead.email].filter(Boolean) as string[];

    let link: string | undefined = meetingLink;
    let googleEventId: string | undefined;
    let resolvedProvider: MeetingProvider = chosenProvider;

    if (chosenProvider === 'google_meet') {
      const meet = await createMeetEvent({
        userId: user.id,
        title,
        description: notes,
        startsAt,
        durationMins: duration,
        attendees: invitees,
      });

      if (meet) {
        link = meet.meetingLink;
        googleEventId = meet.googleEventId;
      } else if (link) {
        // Google isn't connected but a link was pasted — honour it.
        resolvedProvider = 'manual';
      } else {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Google Calendar is not connected. Connect it in Settings, or paste a meeting link manually.'
        );
      }
    }

    const schedule = await Schedule.create({
      leadId,
      userId: user.id,
      companyId: user.companyId,
      title,
      scheduledAt: startsAt,
      durationMins: duration,
      location,
      notes,
      status: 'scheduled',
      provider: resolvedProvider,
      meetingLink: link,
      googleEventId,
      attendees: invitees,
    });

    // Reflect the date on the lead so it surfaces on the right day. Which date
    // depends on the stage the agent already moved it to — scheduling never
    // moves a lead itself, because moving leads is the agent's call.
    if (lead.status === 'meeting') {
      lead.meetingDate = startsAt;
      await lead.save();
    } else if (lead.status !== 'won' && lead.status !== 'lost') {
      lead.followUpDate = startsAt;
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

    const existing = await Schedule.findOne({ _id: param(req.params.id), ...ownedScope(user) });
    if (!existing) throw new ApiError('NOT_FOUND', 'Schedule not found.');

    const allowed: Record<string, unknown> = {};
    for (const key of ['title', 'scheduledAt', 'durationMins', 'location', 'notes', 'status', 'meetingLink']) {
      if (body[key] !== undefined) allowed[key] = body[key];
    }
    if (allowed.scheduledAt) allowed.scheduledAt = new Date(allowed.scheduledAt as string);

    const schedule = await Schedule.findOneAndUpdate(
      { _id: existing._id },
      { $set: allowed },
      { returnDocument: 'after' }
    )
      .populate('leadId', 'name company phone')
      .lean();

    // Keep the Google Calendar event in step with the reschedule/cancel.
    if (existing.googleEventId) {
      await updateMeetEvent({
        userId: user.id,
        eventId: existing.googleEventId,
        startsAt: allowed.scheduledAt as Date | undefined,
        durationMins: (allowed.durationMins as number) ?? existing.durationMins,
        cancelled: allowed.status === 'cancelled',
      });
    }

    res.json({ schedule });
  })
);

/** Which lead status a meeting outcome should move the lead to. */
const OUTCOME_TO_LEAD_STATUS: Record<MeetingOutcome, LeadStatus | null> = {
  interested: 'pipeline',
  follow_up: 'dailytask',
  deal_closed: 'won',
  not_interested: 'lost',
  rescheduled: null, // lead stays where it is
};

/**
 * POST /api/schedule/:id/complete
 * Wraps a meeting up: stores the outcome, notes and any recording link, then
 * moves the lead on so the pipeline reflects what was actually decided.
 */
scheduleRouter.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const { outcome, outcomeNotes, recordingUrl, actualDurationMins, followUpDate } = req.body ?? {};

    const valid = Object.keys(OUTCOME_TO_LEAD_STATUS) as MeetingOutcome[];
    if (!outcome || !valid.includes(outcome as MeetingOutcome)) {
      throw new ApiError('VALIDATION_ERROR', `outcome is required and must be one of: ${valid.join(', ')}.`);
    }

    const schedule = await Schedule.findOne({ _id: param(req.params.id), ...ownedScope(user) });
    if (!schedule) throw new ApiError('NOT_FOUND', 'Schedule not found.');
    if (schedule.status === 'completed') {
      throw new ApiError('CONFLICT', 'This meeting has already been completed.');
    }

    // The lead is resolved and vetted before anything is written, so a missing
    // follow-up date can't leave the meeting completed and the lead stranded.
    const nextStatus = OUTCOME_TO_LEAD_STATUS[outcome as MeetingOutcome];
    const lead = await Lead.findOne({ _id: schedule.leadId, ...leadScope(user) });

    const moving = Boolean(lead && nextStatus && lead.status !== nextStatus);
    // Daily Task is read one day at a time, so a follow-up outcome has to name
    // the day it's due — otherwise the lead lands on no list at all.
    if (moving && nextStatus === 'dailytask' && !followUpDate && !lead!.followUpDate) {
      throw new ApiError('VALIDATION_ERROR', 'followUpDate is required for a follow_up outcome.');
    }

    schedule.status = 'completed';
    schedule.outcome = outcome;
    schedule.outcomeNotes = outcomeNotes;
    schedule.recordingUrl = recordingUrl;
    schedule.completedAt = new Date();
    schedule.actualDurationMins = actualDurationMins ?? schedule.durationMins;
    await schedule.save();

    if (lead && nextStatus && moving) {
      if (followUpDate) lead.followUpDate = new Date(followUpDate);

      lead.statusHistory.push({
        from: lead.status,
        to: nextStatus,
        by: user.id as never,
        at: new Date(),
        note: `Meeting outcome: ${outcome}`,
      });
      lead.status = nextStatus;

      if (nextStatus === 'won' && !lead.wonValue) lead.wonValue = lead.dealValue;

      await lead.save();
    }

    const populated = await schedule.populate('leadId', 'name company phone status');
    res.json({ schedule: populated, leadStatus: lead?.status ?? null });
  })
);

/** DELETE /api/schedule/:id */
scheduleRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const schedule = await Schedule.findOne({ _id: param(req.params.id), ...ownedScope(user) });
    if (!schedule) throw new ApiError('NOT_FOUND', 'Schedule not found.');

    if (schedule.googleEventId) {
      await updateMeetEvent({ userId: user.id, eventId: schedule.googleEventId, cancelled: true });
    }
    await schedule.deleteOne();

    res.json({ message: 'Schedule deleted' });
  })
);
