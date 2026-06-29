import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongoose';
import { Lead } from '@/models/Lead';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const tab = searchParams.get('tab');
  const date = searchParams.get('date');
  const search = searchParams.get('search');
  const pipeline = searchParams.get('pipeline');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const skip = (page - 1) * limit;

  await connectDB();

  const companyId = (session.user as any).companyId;
  const userId = session.user.id;
  const role = (session.user as any).role;

  const query: Record<string, unknown> = { companyId };

  // RBAC: agents see only their leads
  if (role === 'agent') {
    query.assignedUser = userId;
  }

  // Tab-based filtering
  if (tab === 'new') {
    query.status = 'new';
  } else if (tab === 'daily') {
    query.status = 'daily';
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.followUpDate = { $gte: start, $lte: end };
    }
  } else if (tab === 'lost') {
    query.status = 'lost';
  } else if (tab === 'won') {
    query.status = 'won';
  } else if (tab === 'pipeline') {
    query.isPipeline = true;
    query.status = { $in: ['new', 'daily'] };
  } else if (tab === 'meeting') {
    query.meetingDate = { $exists: true, $ne: null };
    query.status = { $in: ['new', 'daily'] };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.meetingDate = { $gte: start, $lte: end };
    }
  } else if (status) {
    query.status = status;
  }

  if (pipeline === 'true') query.isPipeline = true;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const [leads, total] = await Promise.all([
    Lead.find(query)
      .populate('assignedUser', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Lead.countDocuments(query),
  ]);

  return NextResponse.json({
    leads,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, phone } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    await connectDB();

    const lead = await Lead.create({
      name,
      phone,
      status: 'new',
      assignedUser: session.user.id,
      companyId: (session.user as any).companyId,
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
