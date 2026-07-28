import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars FIRST
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

import { connectDB } from '../lib/mongoose.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';

async function createAdmin() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected!');

    const email = 'admin@test.com';
    const password = 'password123';

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists:', email);
      process.exit(0);
    }

    const company = await Company.create({
      name: 'Test Company',
      subscriptionPlan: 'free',
    });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: 'Admin User',
      email,
      password: hashedPassword,
      role: 'admin',
      companyId: company._id,
    });

    console.log('Admin user created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
