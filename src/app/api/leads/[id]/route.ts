import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongoose';
import { Lead } from '@/models/Lead';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const lead = await Lead.findOne({
    _id: id,
    companyId: (session.user as any).companyId,
  })
    .populate('assignedUser', 'name email')
    .lean();

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    await connectDB();

    const lead = await Lead.findOneAndUpdate(
      { _id: id, companyId: (session.user as any).companyId },
      { $set: body },
      { new: true }
    ).lean();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();
  await Lead.findOneAndDelete({ _id: id, companyId: (session.user as any).companyId });
  return NextResponse.json({ message: 'Lead deleted' });
}
