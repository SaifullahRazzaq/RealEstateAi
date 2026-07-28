import mongoose, { Schema, Document, Model } from 'mongoose';

export type LeadStatus = 'new' | 'daily' | 'lost' | 'won';

export interface ILead extends Document {
  name: string;
  phone: string;
  status: LeadStatus;
  followUpDate?: Date;
  isPipeline: boolean;
  meetingDate?: Date;
  assignedUser: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['new', 'daily', 'lost', 'won'],
      default: 'new',
    },
    followUpDate: { type: Date },
    isPipeline: { type: Boolean, default: false },
    meetingDate: { type: Date },
    assignedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true }
);

LeadSchema.index({ companyId: 1, status: 1 });
LeadSchema.index({ companyId: 1, assignedUser: 1 });
LeadSchema.index({ companyId: 1, isPipeline: 1 });
LeadSchema.index({ companyId: 1, followUpDate: 1 });

export const Lead: Model<ILead> =
  mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
