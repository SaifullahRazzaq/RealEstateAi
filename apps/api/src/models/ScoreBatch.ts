import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * A bulk scoring run.
 *
 * Anthropic holds the work; this row is only what lets us find it again — a
 * serverless request cannot wait for a batch to finish, so the client polls and
 * whichever request first sees the batch ended applies the results.
 */
export interface IScoreBatch extends Document {
  companyId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  /** The Anthropic batch id — the actual handle on the work. */
  batchId: string;
  total: number;
  /** Set once results have been written onto the leads, so we do it only once. */
  appliedAt?: Date;
  applied: { scored: number; failed: number };
  createdAt: Date;
  updatedAt: Date;
}

const ScoreBatchSchema = new Schema<IScoreBatch>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    batchId: { type: String, required: true, unique: true },
    total: { type: Number, required: true },
    appliedAt: { type: Date },
    applied: {
      scored: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

ScoreBatchSchema.index({ companyId: 1, createdAt: -1 });

export const ScoreBatch: Model<IScoreBatch> =
  mongoose.models.ScoreBatch || mongoose.model<IScoreBatch>('ScoreBatch', ScoreBatchSchema);
