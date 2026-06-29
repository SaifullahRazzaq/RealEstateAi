import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongoose';
import { User } from '@/models/User';
import { Company } from '@/models/Company';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, companyName } = await req.json();

    if (!name || !email || !password || !companyName) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    await connectDB();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Create company
    const company = await Company.create({ name: companyName, subscriptionPlan: 'free' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      companyId: company._id,
    });

    return NextResponse.json(
      { message: 'Account created successfully', userId: user._id },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
