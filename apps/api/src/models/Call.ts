import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICall extends Document {
  leadId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  duration?: number;
  createdAt: Date;
}

const CallSchema = new Schema<ICall>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    duration: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CallSchema.index({ companyId: 1, createdAt: -1 });
CallSchema.index({ userId: 1, createdAt: -1 });

export const Call: Model<ICall> =
  mongoose.models.Call || mongoose.model<ICall>('Call', CallSchema);
