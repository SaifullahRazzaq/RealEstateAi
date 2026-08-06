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
import { Property, type PropertyType, type PropertyStatus } from '../models/Property.js';
import { Call } from '../models/Call.js';
import { Comment } from '../models/Comment.js';
import { Schedule } from '../models/Schedule.js';
import { toSqft, type AreaUnit } from '../lib/area.js';

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
    { name: 'Rabia Noor', phone: '03001112202', company: 'Noor Textiles', status: 'dailytask', dealValue: 12000000, source: 'Website' },
    { name: 'Kamran Butt', phone: '03001112203', company: 'Butt Motors', status: 'meeting', dealValue: 25000000, source: 'Referral' },
    { name: 'Zeeshan Ali', phone: '03001112204', company: 'Ali Traders', status: 'pipeline', dealValue: 6000000, source: 'Walk-in' },
    { name: 'Farhan Iqbal', phone: '03001112205', company: 'Iqbal Group', status: 'won', dealValue: 18000000, source: 'Referral' },
  ],
  'sana@skyline.demo': [
    { name: 'Mariam Yousaf', phone: '03001112301', company: 'Yousaf Estates', status: 'new', dealValue: 9500000, source: 'Instagram' },
    { name: 'Tahir Mehmood', phone: '03001112302', company: 'Mehmood & Sons', status: 'dailytask', dealValue: 15000000, source: 'Website' },
    { name: 'Nimra Aslam', phone: '03001112303', company: 'Aslam Developers', status: 'meeting', dealValue: 32000000, source: 'Facebook' },
    { name: 'Owais Raza', phone: '03001112304', company: 'Raza Industries', status: 'pipeline', dealValue: 7500000, source: 'Cold Call' },
    { name: 'Hina Tariq', phone: '03001112305', company: 'Tariq Marketing', status: 'lost', dealValue: 4000000, source: 'Walk-in' },
  ],
};

/**
 * Stock to match clients against. Spread across two societies and both plot
 * and house so the matcher has something to actually discriminate between —
 * a demo where everything scores 100% shows nothing about how it works.
 */
const PROPERTIES: Array<{
  title: string; type: PropertyType; society: string; block?: string;
  size: number; unit: AreaUnit; price: number; status?: PropertyStatus;
  corner?: boolean; parkFacing?: boolean; bedrooms?: number;
}> = [
  { title: '10 marla corner plot, DHA Phase 6', type: 'plot', society: 'DHA Phase 6', block: 'Block K', size: 10, unit: 'marla', price: 24_000_000, corner: true },
  { title: '10 marla plot, DHA Phase 6', type: 'plot', society: 'DHA Phase 6', block: 'Block N', size: 10, unit: 'marla', price: 22_500_000 },
  { title: '1 kanal plot, DHA Phase 6', type: 'plot', society: 'DHA Phase 6', block: 'Block M', size: 1, unit: 'kanal', price: 47_000_000, parkFacing: true },
  { title: '5 marla plot, DHA Phase 8', type: 'plot', society: 'DHA Phase 8', block: 'Ex Air Avenue', size: 5, unit: 'marla', price: 11_500_000 },
  { title: '10 marla plot, DHA Phase 8', type: 'plot', society: 'DHA Phase 8', size: 10, unit: 'marla', price: 26_000_000, corner: true },
  { title: '5 marla house, Bahria Town', type: 'house', society: 'Bahria Town', block: 'Sector C', size: 5, unit: 'marla', price: 16_500_000, bedrooms: 3 },
  { title: '10 marla house, Bahria Town', type: 'house', society: 'Bahria Town', block: 'Overseas B', size: 10, unit: 'marla', price: 34_000_000, bedrooms: 5 },
  { title: '1 kanal house, DHA Phase 6', type: 'house', society: 'DHA Phase 6', block: 'Block L', size: 1, unit: 'kanal', price: 92_000_000, bedrooms: 6 },
  { title: '8 marla plot, Bahria Town', type: 'plot', society: 'Bahria Town', block: 'Sector E', size: 8, unit: 'marla', price: 13_800_000 },
  { title: '2 kanal farmhouse plot, Bedian Road', type: 'agricultural', society: 'Bedian Road', size: 2, unit: 'kanal', price: 38_000_000 },
  { title: '4 marla commercial, Gulberg', type: 'shop', society: 'Gulberg III', block: 'Main Boulevard', size: 4, unit: 'marla', price: 62_000_000 },
  // Two off the market, so the status filter and the "spoken for" case are visible.
  { title: '10 marla plot, DHA Phase 6 (on token)', type: 'plot', society: 'DHA Phase 6', block: 'Block J', size: 10, unit: 'marla', price: 23_000_000, status: 'token' },
  { title: '5 marla plot, DHA Phase 8 (sold)', type: 'plot', society: 'DHA Phase 8', size: 5, unit: 'marla', price: 12_000_000, status: 'sold' },
];

/**
 * What each open lead is looking for, keyed by lead name. Deliberately varied:
 * one matches stock exactly, one is slightly over-budget, one wants a society
 * with little stock — so the score column reads as a range, not a row of 100s.
 */
const REQUIREMENTS: Record<string, {
  types: PropertyType[]; maxBudget: number; minBudget?: number;
  locations: string[]; size?: number; unit?: AreaUnit; intent?: 'investment' | 'end-use';
}> = {
  'Hamza Sheikh': { types: ['plot'], maxBudget: 25_000_000, locations: ['DHA Phase 6'], size: 10, unit: 'marla', intent: 'investment' },
  'Rabia Noor': { types: ['house'], maxBudget: 35_000_000, locations: ['Bahria Town'], size: 10, unit: 'marla', intent: 'end-use' },
  'Kamran Butt': { types: ['plot'], maxBudget: 50_000_000, minBudget: 40_000_000, locations: ['DHA Phase 6', 'DHA Phase 8'], size: 1, unit: 'kanal', intent: 'investment' },
  'Zeeshan Ali': { types: ['plot'], maxBudget: 12_000_000, locations: ['DHA Phase 8'], size: 5, unit: 'marla', intent: 'investment' },
  'Mariam Yousaf': { types: ['plot', 'house'], maxBudget: 18_000_000, locations: ['Bahria Town'], size: 5, unit: 'marla', intent: 'end-use' },
  'Tahir Mehmood': { types: ['plot'], maxBudget: 27_000_000, locations: ['DHA Phase 8'], size: 10, unit: 'marla', intent: 'investment' },
  'Owais Raza': { types: ['shop'], maxBudget: 70_000_000, locations: ['Gulberg'], intent: 'investment' },
  'Nimra Aslam': { types: ['house'], maxBudget: 95_000_000, locations: ['DHA Phase 6'], size: 1, unit: 'kanal', intent: 'end-use' },
};

/**
 * Closed deals dated back across the range so the revenue chart has a shape.
 * `daysAgo` becomes the lead's updatedAt, which is what the dashboard groups
 * revenue by — created today, they would all stack on one column.
 */
const WON_DEALS = [
  { name: 'Adnan Sethi', phone: '03009990001', sale: 24_000_000, daysAgo: 27, rate: 1, side: 'both' as const, dealer: 0 },
  { name: 'Faisal Karim', phone: '03009990002', sale: 11_500_000, daysAgo: 24, rate: 1, side: 'both' as const, dealer: 0 },
  { name: 'Nadia Hassan', phone: '03009990003', sale: 47_000_000, daysAgo: 20, rate: 1, side: 'seller' as const, dealer: 0 },
  { name: 'Imran Qureshi', phone: '03009990004', sale: 16_500_000, daysAgo: 17, rate: 1, side: 'both' as const, dealer: 50 },
  { name: 'Saima Javed', phone: '03009990005', sale: 34_000_000, daysAgo: 12, rate: 1, side: 'both' as const, dealer: 0 },
  { name: 'Waqar Younis', phone: '03009990006', sale: 13_800_000, daysAgo: 8, rate: 1.5, side: 'buyer' as const, dealer: 0 },
  { name: 'Hira Shah', phone: '03009990007', sale: 62_000_000, daysAgo: 5, rate: 1, side: 'both' as const, dealer: 30 },
  { name: 'Junaid Akram', phone: '03009990008', sale: 26_000_000, daysAgo: 2, rate: 1, side: 'both' as const, dealer: 0 },
];

/** Deals holding bayana, so the Token page and its KPIs are not empty. */
const TOKEN_DEALS = [
  { name: 'Shahid Anwar', phone: '03008880001', sale: 23_000_000, token: 500_000, transferInDays: 14 },
  { name: 'Ayesha Siddiqui', phone: '03008880002', sale: 38_000_000, token: 1_000_000, transferInDays: 21 },
  { name: 'Rehan Baig', phone: '03008880003', sale: 16_500_000, token: 300_000, transferInDays: 6 },
];

async function main() {
  await connectDB();

  // --- reset any previous demo run -----------------------------------------
  const existingCompany = await Company.findOne({ name: COMPANY_NAME });
  if (existingCompany) {
    const id = existingCompany._id;
    await Promise.all([
      Lead.deleteMany({ companyId: id }),
      Property.deleteMany({ companyId: id }),
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
      const want = REQUIREMENTS[row.name];
      const lead = await Lead.create({
        ...row,
        email: `${row.name.split(' ')[0].toLowerCase()}@example.com`,
        assignedUser: owner._id,
        companyId: company._id,
        commission: { rate: 1, side: 'both', dealerSharePercent: 0 },
        requirement: want
          ? {
              types: want.types,
              purpose: 'sale',
              minBudget: want.minBudget ?? 0,
              maxBudget: want.maxBudget,
              locations: want.locations,
              minAreaSqft: want.size ? toSqft(want.size, want.unit ?? 'marla') : 0,
              maxAreaSqft: want.size ? toSqft(want.size, want.unit ?? 'marla') : 0,
              areaUnit: want.unit ?? 'marla',
              intent: want.intent,
            }
          : undefined,
        wonValue: row.status === 'won' ? row.dealValue : 0,
        followUpDate: row.status === 'dailytask' ? new Date(now + 86400000) : undefined,
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
          title: `Site visit with ${row.name}`,
          scheduledAt: new Date(now + 2 * 86400000),
          durationMins: 45,
          location: 'DHA Phase 6, Lahore',
          status: 'scheduled',
        });
      }
    }
  }

  // --- stock -----------------------------------------------------------------
  // `create` rather than `insertMany`: the pre-save hook is what derives
  // areaSqft and ratePerMarla, and insertMany skips document middleware.
  const agents = users.filter((u) => u.role === 'agent');
  for (const [i, p] of PROPERTIES.entries()) {
    await Property.create({
      companyId: company._id,
      assignedUser: agents[i % agents.length]._id,
      code: `${p.society.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}-${1000 + i}`,
      title: p.title,
      type: p.type,
      purpose: 'sale',
      status: p.status ?? 'available',
      city: 'Lahore',
      society: p.society,
      block: p.block,
      size: p.size,
      sizeUnit: p.unit,
      price: p.price,
      corner: p.corner ?? false,
      parkFacing: p.parkFacing ?? false,
      bedrooms: p.bedrooms,
      ownerName: 'Owner (demo)',
      ownerPhone: `0300${String(7770000 + i)}`,
    });
  }

  // --- closed deals, dated back so the revenue chart has a shape ------------
  // save({ timestamps: false }) keeps the backdated updatedAt: Mongoose would
  // otherwise stamp today, and the whole chart would collapse onto one column.
  for (const [i, d] of WON_DEALS.entries()) {
    const closedAt = new Date(now - d.daysAgo * 86400000);
    const lead = new Lead({
      name: d.name,
      phone: d.phone,
      email: `${d.name.split(' ')[0].toLowerCase()}@example.com`,
      source: ['Referral', 'Facebook', 'Website', 'Walk-in'][i % 4],
      status: 'won',
      assignedUser: agents[i % agents.length]._id,
      companyId: company._id,
      dealValue: d.sale,
      wonValue: d.sale,
      commission: { rate: d.rate, side: d.side, dealerSharePercent: d.dealer },
      statusHistory: [{ from: 'meeting', to: 'won', by: agents[i % agents.length]._id, at: closedAt, note: 'Transfer completed' }],
    });
    lead.createdAt = new Date(closedAt.getTime() - 20 * 86400000);
    lead.updatedAt = closedAt;
    await lead.save({ timestamps: false });
    leadCount++;
  }

  // --- deals holding bayana -------------------------------------------------
  for (const [i, d] of TOKEN_DEALS.entries()) {
    const tokenAt = new Date(now - (i + 2) * 86400000);
    const lead = new Lead({
      name: d.name,
      phone: d.phone,
      email: `${d.name.split(' ')[0].toLowerCase()}@example.com`,
      source: 'Referral',
      status: 'token',
      assignedUser: agents[i % agents.length]._id,
      companyId: company._id,
      dealValue: d.sale,
      tokenAmount: d.token,
      tokenDate: tokenAt,
      expectedTransferDate: new Date(now + d.transferInDays * 86400000),
      commission: { rate: 1, side: 'both', dealerSharePercent: 0 },
      statusHistory: [{ from: 'meeting', to: 'token', by: agents[i % agents.length]._id, at: tokenAt, note: 'Bayana received' }],
    });
    lead.createdAt = new Date(tokenAt.getTime() - 15 * 86400000);
    lead.updatedAt = tokenAt;
    await lead.save({ timestamps: false });
    leadCount++;
  }

  const [totals] = await Lead.aggregate([
    { $match: { companyId: company._id, status: 'won' } },
    { $group: { _id: null, sales: { $sum: '$wonValue' }, earned: { $sum: '$commission.net' } } },
  ]);
  const money = (n: number) => 'Rs ' + Math.round(n || 0).toLocaleString('en-PK');

  console.log('\n' + '='.repeat(58));
  console.log(`Company:    ${COMPANY_NAME}`);
  console.log(`Leads:      ${leadCount}`);
  console.log(`Properties: ${PROPERTIES.length}`);
  console.log(`Won:        ${WON_DEALS.length} deals — ${money(totals?.sales)} sold, ${money(totals?.earned)} earned`);
  console.log(`On token:   ${TOKEN_DEALS.length} deals`);
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
