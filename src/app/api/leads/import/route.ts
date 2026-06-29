import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongoose';
import { Lead } from '@/models/Lead';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<{ Name?: string; name?: string; Phone?: string; phone?: string }>(worksheet);

    if (!data.length) {
      return NextResponse.json({ error: 'Empty file or invalid format' }, { status: 400 });
    }

    await connectDB();

    const companyId = (session.user as any).companyId;
    const userId = session.user.id;

    const leads = data.map((row) => ({
      name: row.Name || row.name || '',
      phone: String(row.Phone || row.phone || ''),
      status: 'new',
      assignedUser: userId,
      companyId,
    })).filter((l) => l.name && l.phone);

    const inserted = await Lead.insertMany(leads);

    return NextResponse.json({ imported: inserted.length }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 });
  }
}
