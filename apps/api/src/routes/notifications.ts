import { Router } from 'express';
import { Lead } from '../models/Lead.js';
import { Schedule } from '../models/Schedule.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, authUser } from '../middleware/auth.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

export type NotificationType = 'meeting' | 'overdue' | 'won' | 'new';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  at: string;
  leadId?: string;
}

notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const user = authUser(req);

  const companyId = user.companyId;
  const isAgent = user.role === 'agent';
  const leadScope = { companyId, ...(isAgent ? { assignedUser: user.id } : {}) };

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);
  const last7d = new Date(now.getTime() - 7 * 86400000);
  const last24h = new Date(now.getTime() - 86400000);

  const [upcoming, overdue, recentWon, recentLeads] = await Promise.all([
    Schedule.find({
      companyId,
      ...(isAgent ? { userId: user.id } : {}),
      status: 'scheduled',
      scheduledAt: { $gte: now, $lte: in48h },
    })
      .populate('leadId', 'name')
      .sort({ scheduledAt: 1 })
      .limit(5)
      .lean(),

    Lead.find({
      ...leadScope,
      status: { $in: ['due', 'followedup'] },
      followUpDate: { $lt: now },
    })
      .sort({ followUpDate: 1 })
      .limit(5)
      .lean(),

    Lead.find({ ...leadScope, status: 'won', updatedAt: { $gte: last7d } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),

    Lead.find({ ...leadScope, status: 'new', createdAt: { $gte: last24h } })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const notifications: Notification[] = [
    ...upcoming.map((s: any) => {
      const leadName: string | undefined = s.leadId?.name;
      // Schedule titles are often already "Meeting with <lead>" — don't say it twice.
      const needsName = leadName && !s.title.toLowerCase().includes(leadName.toLowerCase());
      return {
        id: `meeting-${s._id}`,
        type: 'meeting' as const,
        title: s.type === 'call' ? 'Call Reminder' : 'Meeting Reminder',
        message: needsName ? `${s.title} with ${leadName}` : s.title,
        at: new Date(s.scheduledAt).toISOString(),
        leadId: s.leadId?._id ? String(s.leadId._id) : undefined,
      };
    }),

    ...overdue.map((l: any) => ({
      id: `overdue-${l._id}`,
      type: 'overdue' as const,
      title: 'Follow-up Overdue',
      message: `${l.name} was due on ${new Date(l.followUpDate).toISOString().split('T')[0]}`,
      at: new Date(l.followUpDate).toISOString(),
      leadId: String(l._id),
    })),

    ...recentWon.map((l: any) => ({
      id: `won-${l._id}`,
      type: 'won' as const,
      title: 'Deal Closed',
      message: `${l.name} moved to Won${l.wonValue ? ` — PKR ${l.wonValue.toLocaleString('en-PK')}` : ''}`,
      at: new Date(l.updatedAt).toISOString(),
      leadId: String(l._id),
    })),

    ...recentLeads.map((l: any) => ({
      id: `new-${l._id}`,
      type: 'new' as const,
      title: 'New Lead Assigned',
      message: `${l.name}${l.company ? ` (${l.company})` : ''} has been assigned to you.`,
      at: new Date(l.createdAt).toISOString(),
      leadId: String(l._id),
    })),
  ]
    // Most recent activity, and imminent meetings, float to the top.
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);

  res.json({
    notifications,
    unreadCount: notifications.length,
  });
}));
