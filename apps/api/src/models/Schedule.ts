import mongoose, { Schema, Document, Model } from 'mongoose';

export type ScheduleType = 'meeting' | 'call' | 'followup';
export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled';

export interface ISchedule extends Document {
  leadId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  type: ScheduleType;
  title: string;
  scheduledAt: Date;
  durationMins: number;
  location?: string;
  notes?: string;
  status: ScheduleStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduleSchema = new Schema<ISchedule>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    type: {
      type: String,
      enum: ['meeting', 'call', 'followup'],
      default: 'meeting',
    },
    title: { type: String, required: true, trim: true },
    scheduledAt: { type: Date, required: true },
    durationMins: { type: Number, default: 30 },
    location: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
  },
  { timestamps: true }
);

ScheduleSchema.index({ companyId: 1, scheduledAt: 1 });
ScheduleSchema.index({ companyId: 1, status: 1 });
ScheduleSchema.index({ leadId: 1, scheduledAt: -1 });
ScheduleSchema.index({ userId: 1, scheduledAt: 1 });

export const Schedule: Model<ISchedule> =
  mongoose.models.Schedule || mongoose.model<ISchedule>('Schedule', ScheduleSchema);
