import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongoose';
import { Lead } from '@/models/Lead';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get('tab') || 'new';

  await connectDB();

  const companyId = (session.user as any).companyId;
  const role = (session.user as any).role;

  const query: Record<string, unknown> = { companyId };
  if (role === 'agent') query.assignedUser = session.user.id;

  const statusMap: Record<string, string> = {
    new: 'new',
    daily: 'daily',
    lost: 'lost',
    won: 'won',
  };
  if (statusMap[tab]) query.status = statusMap[tab];

  const leads = await Lead.find(query).populate('assignedUser', 'name email').lean();

  const rows = leads.map((l) => ({
    Name: l.name,
    Phone: l.phone,
    Status: l.status,
    Pipeline: l.isPipeline ? 'Yes' : 'No',
    FollowUpDate: l.followUpDate ? new Date(l.followUpDate).toLocaleDateString() : '',
    MeetingDate: l.meetingDate ? new Date(l.meetingDate).toLocaleDateString() : '',
    AssignedTo: (l.assignedUser as any)?.name || '',
    CreatedAt: new Date(l.createdAt).toLocaleDateString(),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="leads-${tab}-${Date.now()}.xlsx"`,
    },
  });
}
