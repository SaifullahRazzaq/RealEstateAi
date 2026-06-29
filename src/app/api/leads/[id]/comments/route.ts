import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongoose';
import { Comment } from '@/models/Comment';
import { Lead } from '@/models/Lead';
import { Call } from '@/models/Call';

// GET comments for a lead
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const { id } = await params;
  const lead = await Lead.findOne({
    _id: id,
    companyId: (session.user as any).companyId,
  });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const comments = await Comment.find({ leadId: id })
    .populate('userId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ comments });
}

// POST comment and log call
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const { comment, logCall } = await req.json();

    if (!comment) return NextResponse.json({ error: 'Comment is required' }, { status: 400 });

    await connectDB();

    const lead = await Lead.findOne({
      _id: id,
      companyId: (session.user as any).companyId,
    });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const newComment = await Comment.create({
      leadId: id,
      userId: session.user.id,
      comment,
    });

    // Log call if requested
    if (logCall) {
      await Call.create({
        leadId: id,
        userId: session.user.id,
        companyId: (session.user as any).companyId,
      });
    }

    const populated = await newComment.populate('userId', 'name');
    return NextResponse.json({ comment: populated }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
