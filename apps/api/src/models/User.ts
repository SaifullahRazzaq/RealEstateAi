import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'agent';
  companyId: mongoose.Types.ObjectId;
  /**
   * Per-user Google OAuth grant. Each agent connects their own account, so the
   * Meet link and any recording belong to the person who ran the meeting.
   */
  google?: {
    email?: string;
    accessToken?: string;
    refreshToken?: string;
    expiryDate?: number;
    connectedAt?: Date;
  };
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'agent'], default: 'agent' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    google: {
      email: String,
      // `select: false` so tokens never ride along on an ordinary user fetch —
      // GET /api/users would otherwise hand them to the client.
      accessToken: { type: String, select: false },
      refreshToken: { type: String, select: false },
      expiryDate: { type: Number, select: false },
      connectedAt: Date,
    },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
