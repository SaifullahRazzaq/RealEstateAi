import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongoose';
import { Call } from '@/models/Call';
import { Lead } from '@/models/Lead';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  await connectDB();

  const companyId = (session.user as any).companyId;
  const role = (session.user as any).role;

  const matchQuery: Record<string, unknown> = { companyId };
  if (role === 'agent') matchQuery.userId = session.user.id;

  const dateFilter: Record<string, any> = {};
  if (startDate && endDate) {
    dateFilter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
    };
  }

  // 1. Call activity over time
  const callReport = await Call.aggregate([
    { $match: { ...matchQuery, ...dateFilter } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        callCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // 2. Lead distribution by status
  const leadDistribution = await Lead.aggregate([
    { $match: { companyId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // 3. Overall Stats
  const totalLeads = await Lead.countDocuments({ companyId });
  const wonLeads = await Lead.countDocuments({ companyId, status: 'won' });
  const lostLeads = await Lead.countDocuments({ companyId, status: 'lost' });
  const totalCalls = await Call.countDocuments({ ...matchQuery, ...dateFilter });

  return NextResponse.json({
    activity: callReport.map((r) => ({ date: r._id, calls: r.callCount })),
    distribution: leadDistribution.map((d) => ({ name: d._id, value: d.count })),
    stats: {
      totalLeads,
      wonLeads,
      lostLeads,
      totalCalls,
      conversionRate: totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0,
    }
  });
}
