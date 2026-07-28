import mongoose, { Schema, Document, Model } from 'mongoose';

// Pipeline statuses. new -> incontact -> followedup / due -> meeting -> won | lost
export type LeadStatus =
  | 'new'
  | 'incontact'
  | 'followedup'
  | 'due'
  | 'meeting'
  | 'won'
  | 'lost';

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'incontact',
  'followedup',
  'due',
  'meeting',
  'won',
  'lost',
];

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
  dealValue: number; // expected / pipeline value in dollars
  wonValue: number; // realised value once won (dollars received)
  followUpDate?: Date;
  isPipeline: boolean;
  meetingDate?: Date;
  assignedUser: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  statusHistory: IStatusChange[];
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
    followUpDate: { type: Date },
    isPipeline: { type: Boolean, default: false },
    meetingDate: { type: Date },
    assignedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    statusHistory: { type: [StatusChangeSchema], default: [] },
  },
  { timestamps: true }
);

LeadSchema.index({ companyId: 1, status: 1 });
LeadSchema.index({ companyId: 1, assignedUser: 1 });
LeadSchema.index({ companyId: 1, isPipeline: 1 });
LeadSchema.index({ companyId: 1, followUpDate: 1 });
LeadSchema.index({ companyId: 1, meetingDate: 1 });
LeadSchema.index({ companyId: 1, createdAt: -1 });

export const Lead: Model<ILead> =
  mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
