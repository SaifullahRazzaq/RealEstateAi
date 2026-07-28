/**
 * Seeds a complete, demo-ready company: one admin and two agents, each agent
 * owning their own leads so the "agents can't see each other's data" rule is
 * visible in the UI straight away.
 *
 *   npm run seed:demo
 *
 * Safe to re-run: it removes the demo users and their leads first.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../lib/mongoose.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { Lead, type LeadStatus } from '../models/Lead.js';
import { Call } from '../models/Call.js';
import { Comment } from '../models/Comment.js';
import { Schedule } from '../models/Schedule.js';

const COMPANY_NAME = 'Skyline Realty (Demo)';
const PASSWORD = 'Demo@1234';

const DEMO_USERS = [
  { name: 'Ayesha Malik', email: 'admin@skyline.demo', role: 'admin' as const },
  { name: 'Bilal Ahmed', email: 'bilal@skyline.demo', role: 'agent' as const },
  { name: 'Sana Khan', email: 'sana@skyline.demo', role: 'agent' as const },
];

/** Leads per agent, so each one has a populated pipeline of their own. */
const LEADS: Record<string, Array<{ name: string; phone: string; company: string; status: LeadStatus; dealValue: number; source: string }>> = {
  'bilal@skyline.demo': [
    { name: 'Hamza Sheikh', phone: '03001112201', company: 'Sheikh Constructions', status: 'new', dealValue: 8500000, source: 'Facebook' },
    { name: 'Rabia Noor', phone: '03001112202', company: 'Noor Textiles', status: 'incontact', dealValue: 12000000, source: 'Website' },
    { name: 'Kamran Butt', phone: '03001112203', company: 'Butt Motors', status: 'meeting', dealValue: 25000000, source: 'Referral' },
    { name: 'Zeeshan Ali', phone: '03001112204', company: 'Ali Traders', status: 'due', dealValue: 6000000, source: 'Walk-in' },
    { name: 'Farhan Iqbal', phone: '03001112205', company: 'Iqbal Group', status: 'won', dealValue: 18000000, source: 'Referral' },
  ],
  'sana@skyline.demo': [
    { name: 'Mariam Yousaf', phone: '03001112301', company: 'Yousaf Estates', status: 'new', dealValue: 9500000, source: 'Instagram' },
    { name: 'Tahir Mehmood', phone: '03001112302', company: 'Mehmood & Sons', status: 'incontact', dealValue: 15000000, source: 'Website' },
    { name: 'Nimra Aslam', phone: '03001112303', company: 'Aslam Developers', status: 'meeting', dealValue: 32000000, source: 'Facebook' },
    { name: 'Owais Raza', phone: '03001112304', company: 'Raza Industries', status: 'followedup', dealValue: 7500000, source: 'Cold Call' },
    { name: 'Hina Tariq', phone: '03001112305', company: 'Tariq Marketing', status: 'lost', dealValue: 4000000, source: 'Walk-in' },
  ],
};

async function main() {
  await connectDB();

  // --- reset any previous demo run -----------------------------------------
  const existingCompany = await Company.findOne({ name: COMPANY_NAME });
  if (existingCompany) {
    const id = existingCompany._id;
    await Promise.all([
      Lead.deleteMany({ companyId: id }),
      Call.deleteMany({ companyId: id }),
      Schedule.deleteMany({ companyId: id }),
      User.deleteMany({ companyId: id }),
    ]);
    await Company.deleteOne({ _id: id });
    console.log('cleared previous demo company');
  }

  // --- company + users ------------------------------------------------------
  const company = await Company.create({ name: COMPANY_NAME, subscriptionPlan: 'pro' });
  const hashed = await bcrypt.hash(PASSWORD, 12);

  const users = await User.insertMany(
    DEMO_USERS.map((u) => ({ ...u, password: hashed, companyId: company._id }))
  );
  const byEmail = new Map(users.map((u) => [u.email, u]));

  // --- leads, owned per agent ----------------------------------------------
  const now = Date.now();
  let leadCount = 0;

  for (const [email, rows] of Object.entries(LEADS)) {
    const owner = byEmail.get(email)!;

    for (const [i, row] of rows.entries()) {
      const createdAt = new Date(now - (i + 1) * 2 * 86400000);
      const lead = await Lead.create({
        ...row,
        email: `${row.name.split(' ')[0].toLowerCase()}@example.com`,
        assignedUser: owner._id,
        companyId: company._id,
        isPipeline: ['meeting', 'due', 'followedup'].includes(row.status),
        wonValue: row.status === 'won' ? row.dealValue : 0,
        followUpDate: ['due', 'followedup'].includes(row.status) ? new Date(now + 86400000) : undefined,
        meetingDate: row.status === 'meeting' ? new Date(now + 2 * 86400000) : undefined,
        createdAt,
        updatedAt: createdAt,
        statusHistory: [
          { from: 'new', to: row.status, by: owner._id, at: createdAt, note: 'Seeded' },
        ],
      });
      leadCount++;

      // A couple of calls and a note each, so Reports has something to chart.
      await Call.insertMany(
        Array.from({ length: 2 + (i % 3) }, (_, k) => ({
          leadId: lead._id,
          userId: owner._id,
          companyId: company._id,
          duration: 60 + k * 45,
          createdAt: new Date(now - (i + 1) * 86400000 - k * 3600000),
        }))
      );

      await Comment.create({
        leadId: lead._id,
        userId: owner._id,
        comment: `Initial discussion with ${row.name.split(' ')[0]}. Interested in ${row.company}.`,
      });

      // Give the "meeting" leads a real scheduled meeting.
      if (row.status === 'meeting') {
        await Schedule.create({
          leadId: lead._id,
          userId: owner._id,
          companyId: company._id,
          type: 'meeting',
          title: `Site visit with ${row.name}`,
          scheduledAt: new Date(now + 2 * 86400000),
          durationMins: 45,
          location: 'DHA Phase 6, Lahore',
          status: 'scheduled',
        });
      }
    }
  }

  console.log('\n' + '='.repeat(58));
  console.log(`Company: ${COMPANY_NAME}`);
  console.log(`Leads:   ${leadCount} (split across the two agents)`);
  console.log('='.repeat(58));
  for (const u of DEMO_USERS) {
    const owned = LEADS[u.email]?.length ?? 'all (admin)';
    console.log(`  ${u.role.padEnd(6)} ${u.email.padEnd(24)} ${PASSWORD}   leads: ${owned}`);
  }
  console.log('='.repeat(58) + '\n');

  await disconnectDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
