import mongoose, { Schema, Document, Model } from 'mongoose';

// Pipeline statuses. new -> incontact -> followedup / due -> meeting -> token -> won | lost
//
// `token` is the stage every Pakistani property deal actually passes through:
// the buyer has paid bayana and the transfer is scheduled, but nothing has
// completed yet. Without it a tokened deal has to be filed as `won` (which
// books revenue that has not arrived) or left at `meeting` (which reports it
// as still uncertain). Both are wrong, and a token can still fall through —
// the seller backs out, the fard turns up a problem, the buyer's finance fails.
export type LeadStatus =
  | 'new'
  | 'incontact'
  | 'followedup'
  | 'due'
  | 'meeting'
  | 'token'
  | 'won'
  | 'lost';

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'incontact',
  'followedup',
  'due',
  'meeting',
  'token',
  'won',
  'lost',
];

export type CommissionSide = 'buyer' | 'seller' | 'both';

export const COMMISSION_SIDES: CommissionSide[] = ['buyer', 'seller', 'both'];

export interface IStatusChange {
  from: LeadStatus;
  to: LeadStatus;
  by: mongoose.Types.ObjectId;
  at: Date;
  note?: string;
}

export interface ILead extends Document {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  source?: string;
  status: LeadStatus;
  /** Sale price of the property, in PKR. NOT what the agency earns. */
  dealValue: number;
  /** Sale price actually realised once the transfer completed, in PKR. */
  wonValue: number;
  /**
   * What the agency earns. Kept apart from the sale price because conflating
   * the two overstates revenue by roughly fifty times: a 2.5 crore sale earns
   * about 5 lakh at the usual 1% per side.
   *
   * `gross` and `net` are derived on every save so reports can `$sum` them
   * directly — recomputing a rate across a whole collection in an aggregation
   * pipeline is how the two figures drift apart.
   */
  commission: {
    /** Percent of the sale price, per side. 1% each way is the market norm. */
    rate: number;
    side: CommissionSide;
    /** Set to override the rate calculation with a negotiated flat fee. */
    amount?: number;
    /** Portion handed to a referring dealer. A 50/50 split is common. */
    dealerSharePercent: number;
    gross: number;
    net: number;
  };
  /** Bayana taken to hold the deal, in PKR. */
  tokenAmount: number;
  tokenDate?: Date;
  /** When the transfer is booked — what the token stage is waiting on. */
  expectedTransferDate?: Date;
  followUpDate?: Date;
  isPipeline: boolean;
  meetingDate?: Date;
  assignedUser: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  statusHistory: IStatusChange[];
  /**
   * Last AI score. Cached on the lead because scoring costs a paid API call —
   * the list view reads whatever was computed last rather than re-scoring on
   * every render. `aiScoredAt` is what tells you the score is stale.
   */
  ai?: {
    score: number;
    band: 'hot' | 'warm' | 'cold';
    reasoning: string;
    nextAction: string;
    signals: { positive: string[]; negative: string[] };
    scoredAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const StatusChangeSchema = new Schema<IStatusChange>(
  {
    from: { type: String, enum: LEAD_STATUSES },
    to: { type: String, enum: LEAD_STATUSES },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    note: { type: String },
  },
  { _id: false }
);

const LeadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    company: { type: String, trim: true },
    source: { type: String, trim: true, default: 'Manual' },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: 'new',
    },
    dealValue: { type: Number, default: 0, min: 0 },
    wonValue: { type: Number, default: 0, min: 0 },
    commission: {
      rate: { type: Number, default: 1, min: 0, max: 100 },
      side: { type: String, enum: COMMISSION_SIDES, default: 'both' },
      amount: { type: Number, min: 0 },
      dealerSharePercent: { type: Number, default: 0, min: 0, max: 100 },
      gross: { type: Number, default: 0, min: 0 },
      net: { type: Number, default: 0, min: 0 },
    },
    tokenAmount: { type: Number, default: 0, min: 0 },
    tokenDate: { type: Date },
    expectedTransferDate: { type: Date },
    followUpDate: { type: Date },
    isPipeline: { type: Boolean, default: false },
    meetingDate: { type: Date },
    assignedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    statusHistory: { type: [StatusChangeSchema], default: [] },
    ai: {
      type: new Schema(
        {
          score: { type: Number, min: 0, max: 100 },
          band: { type: String, enum: ['hot', 'warm', 'cold'] },
          reasoning: { type: String },
          nextAction: { type: String },
          signals: {
            positive: { type: [String], default: [] },
            negative: { type: [String], default: [] },
          },
          scoredAt: { type: Date },
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

/**
 * The single place commission is calculated. Anything that writes a lead gets
 * consistent `gross`/`net` for free, which is what lets the dashboard sum them
 * without knowing the rules.
 */
export function computeCommission(lead: Pick<ILead, 'commission' | 'wonValue' | 'dealValue'>) {
  const c = lead.commission;
  // Once a deal completes the realised price is the honest base; before that
  // the expected price is the only figure available.
  const base = lead.wonValue > 0 ? lead.wonValue : lead.dealValue;
  const sides = c.side === 'both' ? 2 : 1;

  const gross = c.amount != null && c.amount >= 0
    ? c.amount
    : Math.round(base * (c.rate / 100) * sides);

  return { gross, net: Math.round(gross * (1 - c.dealerSharePercent / 100)) };
}

LeadSchema.pre('save', function (this: ILead) {
  const { gross, net } = computeCommission(this);
  this.commission.gross = gross;
  this.commission.net = net;
});

LeadSchema.index({ companyId: 1, status: 1 });
// Token deals are chased by transfer date, so that is how they get read.
LeadSchema.index({ companyId: 1, expectedTransferDate: 1 });
LeadSchema.index({ companyId: 1, assignedUser: 1 });
LeadSchema.index({ companyId: 1, isPipeline: 1 });
LeadSchema.index({ companyId: 1, followUpDate: 1 });
LeadSchema.index({ companyId: 1, meetingDate: 1 });
LeadSchema.index({ companyId: 1, createdAt: -1 });
// Sorting the pipeline by AI score is the whole point of storing it.
LeadSchema.index({ companyId: 1, 'ai.score': -1 });

export const Lead: Model<ILead> =
  mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
