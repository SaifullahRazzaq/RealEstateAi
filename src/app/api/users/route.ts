import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/mongoose';
import { User } from '@/models/User';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  const companyId = (session.user as any).companyId;

  const users = await User.find({ companyId })
    .select('-password')
    .sort({ createdAt: -1 });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, email, password, role } = await req.json();
    
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    await connectDB();
    const companyId = (session.user as any).companyId;

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'agent',
      companyId,
    });

    return NextResponse.json({ user: { id: user._id, name, email, role } }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
