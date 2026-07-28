import { Router } from 'express';
import mongoose from 'mongoose';
import { Lead, type LeadStatus } from '../models/Lead.js';
import { Schedule } from '../models/Schedule.js';
import { Call } from '../models/Call.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, authUser } from '../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

/** Express gives query values as string | string[] | ParsedQs; we only ever want a string. */
const qs = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const OPEN_STATUSES: LeadStatus[] = ['new', 'incontact', 'followedup', 'due', 'meeting'];

function dayKey(d: Date) {
  return d.toISOString().split('T')[0];
}

// Build a continuous list of YYYY-MM-DD between start and end (inclusive, capped).
function eachDay(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(0, 0, 0, 0);
  let guard = 0;
  while (cur <= stop && guard < 400) {
    days.push(dayKey(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return days;
}

dashboardRouter.get('/', asyncHandler(async (req, res) => {
  const user = authUser(req);

    const startParam = qs(req.query.start);
  const endParam = qs(req.query.end);

  const end = endParam ? new Date(endParam) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = startParam ? new Date(startParam) : new Date(Date.now() - 29 * 86400000);
  start.setHours(0, 0, 0, 0);

  const companyId = new mongoose.Types.ObjectId(user.companyId);
  const role = user.role;
  const userId = new mongoose.Types.ObjectId(user.id);

  // Base scope: agents only see their own leads.
  const scope: Record<string, unknown> = { companyId };
  if (role === 'agent') scope.assignedUser = userId;

  const createdInRange = {
    ...scope,
    createdAt: { $gte: start, $lte: end },
  };
  const movedInRange = {
    ...scope,
    updatedAt: { $gte: start, $lte: end },
  };

  const [
    // Snapshot counts (current pipeline state, whole company scope)
    totalLeads,
    statusAgg,
    sourceAgg,
    pipelineAgg,
    // Range-based metrics
    createdCount,
    wonAgg,
    lostCount,
    meetingsScheduled,
    callsInRange,
    createdSeries,
    wonLostSeries,
    topDeals,
    recentWon,
    upcomingMeetings,
  ] = await Promise.all([
    Lead.countDocuments(scope),
    Lead.aggregate([
      { $match: scope },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      { $match: scope },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Lead.aggregate([
      { $match: { ...scope, status: { $in: OPEN_STATUSES } } },
      { $group: { _id: null, value: { $sum: '$dealValue' }, count: { $sum: 1 } } },
    ]),
    Lead.countDocuments(createdInRange),
    Lead.aggregate([
      { $match: { ...movedInRange, status: 'won' } },
      { $group: { _id: null, revenue: { $sum: '$wonValue' }, count: { $sum: 1 } } },
    ]),
    Lead.countDocuments({ ...movedInRange, status: 'lost' }),
    Schedule.countDocuments({
      companyId,
      ...(role === 'agent' ? { userId } : {}),
      scheduledAt: { $gte: start, $lte: end },
    }),
    Call.countDocuments({
      companyId,
      ...(role === 'agent' ? { userId } : {}),
      createdAt: { $gte: start, $lte: end },
    }),
    Lead.aggregate([
      { $match: createdInRange },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Lead.aggregate([
      { $match: { ...movedInRange, status: { $in: ['won', 'lost'] } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
            status: '$status',
          },
          count: { $sum: 1 },
          revenue: { $sum: '$wonValue' },
        },
      },
    ]),
    Lead.find({ ...scope, status: { $in: OPEN_STATUSES } })
      .sort({ dealValue: -1 })
      .limit(5)
      .populate('assignedUser', 'name')
      .select('name company status dealValue assignedUser')
      .lean(),
    Lead.find({ ...scope, status: 'won' })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('assignedUser', 'name')
      .select('name company wonValue updatedAt assignedUser')
      .lean(),
    Schedule.find({
      companyId,
      ...(role === 'agent' ? { userId } : {}),
      status: 'scheduled',
      scheduledAt: { $gte: new Date() },
    })
      .sort({ scheduledAt: 1 })
      .limit(6)
      .populate('leadId', 'name company phone')
      .lean(),
  ]);

  // Status snapshot map
  const statusMap: Record<string, number> = {};
  for (const s of statusAgg) statusMap[s._id] = s.count;

  const wonRevenue = wonAgg[0]?.revenue || 0;
  const wonCount = wonAgg[0]?.count || 0;
  const pipelineValue = pipelineAgg[0]?.value || 0;
  const closedInRange = wonCount + lostCount;

  // Build continuous time-series
  const createdByDay: Record<string, number> = {};
  for (const r of createdSeries) createdByDay[r._id] = r.count;

  const wonByDay: Record<string, number> = {};
  const lostByDay: Record<string, number> = {};
  const revByDay: Record<string, number> = {};
  for (const r of wonLostSeries) {
    if (r._id.status === 'won') {
      wonByDay[r._id.day] = r.count;
      revByDay[r._id.day] = r.revenue || 0;
    } else {
      lostByDay[r._id.day] = r.count;
    }
  }

  const timeseries = eachDay(start, end).map((d) => ({
    date: d,
    created: createdByDay[d] || 0,
    won: wonByDay[d] || 0,
    lost: lostByDay[d] || 0,
    revenue: revByDay[d] || 0,
  }));

  res.json({
    range: { start: start.toISOString(), end: end.toISOString() },
    kpis: {
      totalLeads,
      newLeads: statusMap['new'] || 0,
      inContact: statusMap['incontact'] || 0,
      followedUp: statusMap['followedup'] || 0,
      due: statusMap['due'] || 0,
      meeting: statusMap['meeting'] || 0,
      wonCount,
      lostCount,
      createdInRange: createdCount,
      meetingsScheduled,
      calls: callsInRange,
      revenueWon: wonRevenue,
      pipelineValue,
      avgDealValue: pipelineAgg[0]?.count ? Math.round(pipelineValue / pipelineAgg[0].count) : 0,
      conversionRate: closedInRange > 0 ? Number(((wonCount / closedInRange) * 100).toFixed(1)) : 0,
    },
    timeseries,
    statusDistribution: [
      { name: 'new', value: statusMap['new'] || 0 },
      { name: 'incontact', value: statusMap['incontact'] || 0 },
      { name: 'followedup', value: statusMap['followedup'] || 0 },
      { name: 'due', value: statusMap['due'] || 0 },
      { name: 'meeting', value: statusMap['meeting'] || 0 },
      { name: 'won', value: statusMap['won'] || 0 },
      { name: 'lost', value: statusMap['lost'] || 0 },
    ].filter((s) => s.value > 0),
    sourceDistribution: sourceAgg.map((s) => ({ name: s._id || 'Unknown', value: s.count })),
    topDeals,
    recentWon,
    upcomingMeetings,
  });
}));
