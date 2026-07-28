import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars FIRST
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

import { connectDB } from '../lib/mongoose.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { Lead } from '../models/Lead.js';
import { Call } from '../models/Call.js';

async function seedData() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected!');

    const user = await User.findOne({ email: 'admin@test.com' });
    if (!user) {
      console.error('Admin user not found. Please run create-admin.ts first.');
      process.exit(1);
    }

    console.log('Clearing existing data for this company...');
    await Lead.deleteMany({ companyId: user.companyId });
    await Call.deleteMany({ companyId: user.companyId });

    const statuses = ['new', 'daily', 'lost', 'won'];
    const names = [
      'Ahmed Khan', 'Sara Ahmed', 'Zubair Sheikh', 'Maria Ali', 'Usman Qureshi',
      'Fatima Zahra', 'Bilal Hassan', 'Ayesha Malik', 'Hamza Butt', 'Sana Javed',
      'Omar Farooq', 'Zainab Bibi', 'Mustafa Kamal', 'Hina Riaz', 'Faisal Shah',
      'Nadia Khan', 'Rizwan Ahmed', 'Kiran Sheikh', 'Asif Ali', 'Tayyaba Noor',
      'Waleed Raja', 'Sadia Imam', 'Irfan Haider', 'Amna Bashir', 'Kamran Akmal',
      'Bushra Ansari', 'Adnan Siddiqui', 'Mahira Khan', 'Humayun Saeed', 'Sajal Aly',
      'Fawad Khan', 'Mehwish Hayat', 'Atif Aslam', 'Rahat Fateh', 'Abida Parveen',
      'Sanam Saeed', 'Ali Zafar', 'Saba Qamar', 'Bilal Ashraf', 'Maya Ali'
    ];

    console.log(`Seeding ${names.length} leads...`);
    const leadsData = [];
    for (let i = 0; i < names.length; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const isPipeline = Math.random() > 0.4;
      
      const lead = {
        name: names[i],
        phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
        status: status,
        isPipeline: isPipeline,
        assignedUser: user._id,
        companyId: user.companyId,
        followUpDate: status === 'daily' ? new Date() : (Math.random() > 0.8 ? new Date(Date.now() + 86400000 * 2) : null),
        meetingDate: Math.random() > 0.7 ? new Date(Date.now() + 86400000 * Math.floor(Math.random() * 7)) : null,
        createdAt: new Date(Date.now() - 86400000 * Math.floor(Math.random() * 30))
      };
      leadsData.push(lead);
    }

    const insertedLeads = await Lead.insertMany(leadsData);
    console.log(`Successfully seeded ${insertedLeads.length} leads!`);

    console.log('Seeding random calls for reports...');
    const callsData = [];
    for (let i = 0; i < 150; i++) {
      const randomLead = insertedLeads[Math.floor(Math.random() * insertedLeads.length)];
      const callDate = new Date(Date.now() - 86400000 * Math.floor(Math.random() * 30));
      
      callsData.push({
        leadId: randomLead._id,
        userId: user._id,
        companyId: user.companyId,
        duration: Math.floor(Math.random() * 300),
        createdAt: callDate,
        updatedAt: callDate
      });
    }

    await Call.insertMany(callsData);
    console.log(`Successfully seeded ${callsData.length} calls!`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

seedData();
