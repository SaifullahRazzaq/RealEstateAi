/**
 * Backfills `commission` on leads written before the field existed.
 *
 * Without this the dashboard reads zero rather than a wrong number: the KPIs
 * now `$sum` `commission.net`, and a document that predates the field has
 * nothing to sum. Every historical won deal would report Rs 0 earned.
 *
 * Safe to re-run. Leads that already carry a computed commission are skipped,
 * so this will not overwrite a rate someone has since negotiated by hand.
 *
 *   npm run backfill:commission --workspace=apps/api
 */
import { connectDB } from '../lib/mongoose.js';
import { Lead } from '../models/Lead.js';

/** The market default: 1% from each side, no dealer taking a cut. */
const DEFAULTS = { rate: 1, side: 'both' as const, dealerSharePercent: 0 };

async function backfill() {
  await connectDB();
  console.log('Connected.\n');

  // Anything with no commission subdocument at all, or one that was never
  // costed. `gross: 0` on a deal with a price means the hook never ran on it.
  const candidates = await Lead.find({
    $or: [{ commission: { $exists: false } }, { 'commission.gross': { $in: [null, 0] } }],
  });

  console.log(`${candidates.length} lead(s) to inspect.`);

  let updated = 0;
  let skipped = 0;

  for (const lead of candidates) {
    // A lead with no price cannot have earned anything. Leave it at zero
    // rather than writing a rate that implies a deal was priced.
    if (!lead.dealValue && !lead.wonValue) {
      skipped++;
      continue;
    }

    if (!lead.commission || lead.commission.rate == null) {
      lead.set('commission', { ...DEFAULTS });
    }

    // The pre-save hook is what computes gross/net — saving is the whole job.
    await lead.save();
    updated++;
  }

  console.log(`\n  costed  : ${updated}`);
  console.log(`  skipped : ${skipped} (no sale price recorded)`);

  const totals = await Lead.aggregate([
    { $match: { status: 'won' } },
    { $group: { _id: null, sales: { $sum: '$wonValue' }, earned: { $sum: '$commission.net' } } },
  ]);

  if (totals[0]) {
    const fmt = (n: number) => 'Rs ' + Math.round(n).toLocaleString('en-PK');
    console.log(`\n  Won deals — sales volume ${fmt(totals[0].sales)}, agency earned ${fmt(totals[0].earned)}`);
  }

  process.exit(0);
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
