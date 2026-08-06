/**
 * Moves leads off the old stage model onto the new one.
 *
 *   incontact | followedup | due  ->  dailytask
 *   isPipeline flag on a new/dailytask lead  ->  pipeline status
 *
 * The starred "hot" flag is gone — Pipeline is a stage now, not a tag — so the
 * leads that carried it are converted rather than dropped, otherwise the hot
 * list simply disappears on deploy. Leads already past Pipeline (meeting,
 * token, won, lost) keep their stage: they are further along than the flag.
 *
 * Daily Task is read one day at a time, so anything landing there without a
 * date is given today's — a dated stage with no date shows on no list at all.
 *
 * Safe to run more than once; a second run finds nothing to do. Pass --dry to
 * see the counts without writing.
 *
 *   npm run migrate:stages -w @real-estate-crm/api -- --dry
 */
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongoose.js';
import { Lead } from '../models/Lead.js';

const OLD_TO_DAILY = ['incontact', 'followedup', 'due'];
const dry = process.argv.includes('--dry');

async function main() {
  await connectDB();
  const leads = mongoose.connection.collection('leads');

  const startOfToday = new Date();
  startOfToday.setHours(9, 0, 0, 0);

  // Read the counts up front: once the first update runs the later filters no
  // longer match, so a dry run and a real run report the same numbers.
  const [toDaily, starred, datelessAfter] = await Promise.all([
    leads.countDocuments({ status: { $in: OLD_TO_DAILY } }),
    leads.countDocuments({
      isPipeline: true,
      status: { $in: [...OLD_TO_DAILY, 'new'] },
    }),
    leads.countDocuments({
      status: { $in: OLD_TO_DAILY },
      isPipeline: { $ne: true },
      $or: [{ followUpDate: null }, { followUpDate: { $exists: false } }],
    }),
  ]);

  console.log(`in contact / followed up / due -> daily task : ${toDaily}`);
  console.log(`  of which starred, so -> pipeline instead   : ${starred}`);
  console.log(`  daily tasks needing a date (set to today)  : ${datelessAfter}`);

  if (dry) {
    console.log('\n--dry: nothing written.');
    await mongoose.disconnect();
    return;
  }

  // Order matters: the starred leads are lifted to `pipeline` first, so the
  // sweep that follows only catches the ones that belong in Daily Task.
  await leads.updateMany(
    { isPipeline: true, status: { $in: [...OLD_TO_DAILY, 'new'] } },
    { $set: { status: 'pipeline' } }
  );

  await leads.updateMany(
    { status: { $in: OLD_TO_DAILY } },
    { $set: { status: 'dailytask' } }
  );

  await leads.updateMany(
    {
      status: 'dailytask',
      $or: [{ followUpDate: null }, { followUpDate: { $exists: false } }],
    },
    { $set: { followUpDate: startOfToday } }
  );

  // The flag has no field on the model any more; leaving it behind would make
  // every lead document disagree with its schema.
  const { modifiedCount } = await leads.updateMany(
    { isPipeline: { $exists: true } },
    { $unset: { isPipeline: '' } }
  );
  console.log(`isPipeline flag removed from                 : ${modifiedCount}`);

  // statusHistory keeps its old stage names on purpose: it is a record of what
  // happened, and rewriting history to say something else would be a lie.

  const remaining = await leads.countDocuments({ status: { $in: OLD_TO_DAILY } });
  console.log(remaining === 0 ? '\nDone.' : `\nWARNING: ${remaining} leads still on an old stage.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
