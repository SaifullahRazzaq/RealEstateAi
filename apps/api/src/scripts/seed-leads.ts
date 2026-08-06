import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars FIRST
const envPath = path.resolve(__dirname, '../../.env.local');

import { connectDB } from '../lib/mongoose.js';
import { User } from '../models/User.js';
import { Lead, LeadStatus } from '../models/Lead.js';
import { Call } from '../models/Call.js';
import { Schedule } from '../models/Schedule.js';

const STATUSES: LeadStatus[] = ['new', 'dailytask', 'pipeline', 'meeting', 'won', 'lost'];
const SOURCES = ['Website', 'Facebook', 'Instagram', 'LinkedIn', 'Referral', 'Zillow', 'Walk-in'];
const COMPANIES = [
  'Nordic Soft AB', 'Travel Ventures', 'Design Studios', 'AI Dynamics', 'EcoTech Solutions',
  'Smart Homes Inc.', 'Foodie Connect', 'Fashion Trendz', 'Virtual Reality Co.', 'Gaming Hub',
  'IronGate Logistics', 'BlueSky Realty', 'Summit Estates', 'Metro Living', 'Coastal Homes',
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min));
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000);
}
function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86400000);
}

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
    await Schedule.deleteMany({ companyId: user.companyId });

    const names = [
      'Ahmed Khan', 'Sara Ahmed', 'Zubair Sheikh', 'Maria Ali', 'Usman Qureshi',
      'Fatima Zahra', 'Bilal Hassan', 'Ayesha Malik', 'Hamza Butt', 'Sana Javed',
      'Omar Farooq', 'Zainab Bibi', 'Mustafa Kamal', 'Hina Riaz', 'Faisal Shah',
      'Nadia Khan', 'Rizwan Ahmed', 'Kiran Sheikh', 'Asif Ali', 'Tayyaba Noor',
      'Waleed Raja', 'Sadia Imam', 'Irfan Haider', 'Amna Bashir', 'Kamran Akmal',
      'Bushra Ansari', 'Adnan Siddiqui', 'Mahira Khan', 'Humayun Saeed', 'Sajal Aly',
      'Fawad Khan', 'Mehwish Hayat', 'Atif Aslam', 'Rahat Fateh', 'Abida Parveen',
      'Sanam Saeed', 'Ali Zafar', 'Saba Qamar', 'Bilal Ashraf', 'Maya Ali',
      'Emma Johansson', 'Ethan Wilson', 'Isabella Hernandez', 'William Lee', 'Sophia Martinez',
      'Ava Clark', 'Lily Walker', 'James Young', 'Mason Allen', 'Jack Robinson',
    ];

    console.log(`Seeding ${names.length} leads...`);
    const leadsData = names.map((name) => {
      const status = rand(STATUSES);
      const createdAt = daysAgo(randInt(0, 60));
      const dealValue = randInt(5, 120) * 1000; // $5k - $120k
      const isWon = status === 'won';
      return {
        name,
        phone: `+1202${randInt(1000000, 9999999)}`,
        email: `${name.split(' ')[0].toLowerCase()}@${rand(COMPANIES).split(' ')[0].toLowerCase()}.com`,
        company: rand(COMPANIES),
        source: rand(SOURCES),
        status,
        dealValue,
        wonValue: isWon ? dealValue : 0,
        assignedUser: user._id,
        companyId: user.companyId,
        followUpDate: status === 'dailytask' ? daysFromNow(randInt(0, 5)) : null,
        meetingDate: status === 'meeting' ? daysFromNow(randInt(0, 7)) : null,
        createdAt,
        updatedAt: isWon || status === 'lost' ? daysAgo(randInt(0, 30)) : createdAt,
        statusHistory: [{ from: 'new', to: status, by: user._id, at: createdAt, note: 'Seeded' }],
      };
    });

    const insertedLeads = await Lead.insertMany(leadsData);
    console.log(`Successfully seeded ${insertedLeads.length} leads!`);

    // Calls
    console.log('Seeding calls...');
    const callsData = Array.from({ length: 200 }, () => {
      const lead = rand(insertedLeads);
      const d = daysAgo(randInt(0, 45));
      return { leadId: lead._id, userId: user._id, companyId: user.companyId, duration: randInt(20, 400), createdAt: d, updatedAt: d };
    });
    await Call.insertMany(callsData);
    console.log(`Seeded ${callsData.length} calls!`);

    // Schedules (upcoming meetings)
    console.log('Seeding schedules...');
    const openLeads = insertedLeads.filter((l) => !['won', 'lost'].includes(l.status));
    const scheduleData = openLeads.slice(0, 12).map((lead) => {
      const type = rand(['meeting', 'call', 'followup'] as const);
      return {
        leadId: lead._id,
        userId: user._id,
        companyId: user.companyId,
        type,
        title: `${type[0].toUpperCase() + type.slice(1)} with ${lead.name}`,
        scheduledAt: daysFromNow(randInt(0, 10)),
        durationMins: rand([15, 30, 45, 60]),
        location: rand(['Office', 'Zoom', 'Phone', 'Client Site']),
        status: 'scheduled' as const,
      };
    });
    await Schedule.insertMany(scheduleData);
    console.log(`Seeded ${scheduleData.length} schedules!`);

    console.log('\n✅ Seed complete.');
    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

seedData();
