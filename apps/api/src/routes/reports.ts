import { Router } from 'express';
import mongoose from 'mongoose';
import { Call } from '../models/Call.js';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, authUser } from '../middleware/auth.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

/** Express gives query values as string | string[] | ParsedQs; we only ever want a string. */
const qs = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Percentage change between two periods, formatted for display. */
function delta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

reportsRouter.get('/', asyncHandler(async (req, res) => {
  const user = authUser(req);

    const startDate = qs(req.query.start);
  const endDate = qs(req.query.end);

  // Aggregation pipelines are NOT auto-cast by mongoose, so these must be real
  // ObjectIds — passing the raw strings silently matches nothing.
  const companyId = new mongoose.Types.ObjectId(user.companyId);
  const userId = new mongoose.Types.ObjectId(user.id);
  const isAgent = user.role === 'agent';

  const end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date();
  const start = startDate
    ? new Date(new Date(startDate).setHours(0, 0, 0, 0))
    : new Date(Date.now() - 29 * 86400000);

  // Immediately preceding window of the same length, used for the trend badges.
  const spanMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(start.getTime() - spanMs);

  const callScope: Record<string, unknown> = { companyId, ...(isAgent ? { userId } : {}) };
  const leadScope: Record<string, unknown> = { companyId, ...(isAgent ? { assignedUser: userId } : {}) };

  const inRange = (from: Date, to: Date) => ({ $gte: from, $lte: to });

  const [
    callSeries,
    leadDistribution,
    totalLeads,
    callsNow,
    callsPrev,
    wonNow,
    wonPrev,
    lostNow,
    lostPrev,
    agentCalls,
    agentCallsPrev,
    agentOutcomes,
    users,
  ] = await Promise.all([
    // 1. Call activity per day
    Call.aggregate([
      { $match: { ...callScope, createdAt: inRange(start, end) } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, callCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

    // 2. Current lead distribution by status
    Lead.aggregate([
      { $match: leadScope },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    Lead.countDocuments(leadScope),

    Call.countDocuments({ ...callScope, createdAt: inRange(start, end) }),
    Call.countDocuments({ ...callScope, createdAt: inRange(prevStart, prevEnd) }),

    // Won/lost are counted by when the lead was last moved, matching the dashboard.
    Lead.countDocuments({ ...leadScope, status: 'won', updatedAt: inRange(start, end) }),
    Lead.countDocuments({ ...leadScope, status: 'won', updatedAt: inRange(prevStart, prevEnd) }),
    Lead.countDocuments({ ...leadScope, status: 'lost', updatedAt: inRange(start, end) }),
    Lead.countDocuments({ ...leadScope, status: 'lost', updatedAt: inRange(prevStart, prevEnd) }),

    // 3. Per-agent performance
    Call.aggregate([
      { $match: { companyId, createdAt: inRange(start, end) } },
      { $group: { _id: '$userId', calls: { $sum: 1 } } },
    ]),
    Call.aggregate([
      { $match: { companyId, createdAt: inRange(prevStart, prevEnd) } },
      { $group: { _id: '$userId', calls: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      { $match: { companyId, status: { $in: ['won', 'lost'] }, updatedAt: inRange(start, end) } },
      { $group: { _id: { user: '$assignedUser', status: '$status' }, count: { $sum: 1 } } },
    ]),

    User.find({ companyId }).select('name email role').lean(),
  ]);

  const callsByUser = new Map(agentCalls.map((r) => [String(r._id), r.calls as number]));
  const prevCallsByUser = new Map(agentCallsPrev.map((r) => [String(r._id), r.calls as number]));
  const wonByUser = new Map<string, number>();
  const lostByUser = new Map<string, number>();
  for (const row of agentOutcomes) {
    const key = String(row._id.user);
    (row._id.status === 'won' ? wonByUser : lostByUser).set(key, row.count);
  }

  const agents = (isAgent ? users.filter((u) => String(u._id) === user.id) : users)
    .map((u) => {
      const key = String(u._id);
      const calls = callsByUser.get(key) || 0;
      const won = wonByUser.get(key) || 0;
      const lost = lostByUser.get(key) || 0;
      const closed = won + lost;
      return {
        id: key,
        name: u.name,
        email: u.email,
        role: u.role,
        calls,
        won,
        lost,
        conversion: closed > 0 ? Number(((won / closed) * 100).toFixed(1)) : 0,
        growth: delta(calls, prevCallsByUser.get(key) || 0),
      };
    })
    .sort((a, b) => b.calls - a.calls || b.won - a.won);

  const closedNow = wonNow + lostNow;
  const closedPrev = wonPrev + lostPrev;
  const conversionNow = closedNow > 0 ? (wonNow / closedNow) * 100 : 0;
  const conversionPrev = closedPrev > 0 ? (wonPrev / closedPrev) * 100 : 0;

  res.json({
    range: { start: start.toISOString(), end: end.toISOString() },
    activity: callSeries.map((r) => ({ date: r._id, calls: r.callCount })),
    distribution: leadDistribution.map((d) => ({ name: d._id, value: d.count })),
    stats: {
      totalLeads,
      wonLeads: wonNow,
      lostLeads: lostNow,
      totalCalls: callsNow,
      conversionRate: Number(conversionNow.toFixed(1)),
    },
    // Real period-over-period movement, compared against the preceding window
    // of identical length.
    trends: {
      totalCalls: delta(callsNow, callsPrev),
      wonLeads: delta(wonNow, wonPrev),
      lostLeads: delta(lostNow, lostPrev),
      conversionRate: delta(conversionNow, conversionPrev),
    },
    agents,
  });
}));
