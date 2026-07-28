import mongoose, { Schema, Document, Model } from 'mongoose';

export type ScheduleType = 'meeting' | 'call' | 'followup';
export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type MeetingProvider = 'google_meet' | 'manual' | 'in_person';
/** What actually came out of the meeting — drives the lead's next status. */
export type MeetingOutcome = 'interested' | 'not_interested' | 'follow_up' | 'deal_closed' | 'rescheduled';

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

  // --- video meeting -------------------------------------------------------
  provider: MeetingProvider;
  /** The joinable URL. For google_meet this comes back from the Calendar API. */
  meetingLink?: string;
  /** Google Calendar event id, kept so the event can be updated or cancelled. */
  googleEventId?: string;
  /** Emails invited to the calendar event. */
  attendees: string[];

  // --- outcome, captured when the meeting is wrapped up ---------------------
  outcome?: MeetingOutcome;
  outcomeNotes?: string;
  /** Link to the recording — Meet drops these in the organiser's Drive. */
  recordingUrl?: string;
  completedAt?: Date;
  actualDurationMins?: number;

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
      enum: ['scheduled', 'completed', 'cancelled', 'no_show'],
      default: 'scheduled',
    },

    provider: {
      type: String,
      enum: ['google_meet', 'manual', 'in_person'],
      default: 'in_person',
    },
    meetingLink: { type: String, trim: true },
    googleEventId: { type: String, trim: true },
    attendees: { type: [String], default: [] },

    outcome: {
      type: String,
      enum: ['interested', 'not_interested', 'follow_up', 'deal_closed', 'rescheduled'],
    },
    outcomeNotes: { type: String, trim: true },
    recordingUrl: { type: String, trim: true },
    completedAt: { type: Date },
    actualDurationMins: { type: Number },
  },
  { timestamps: true }
);

ScheduleSchema.index({ companyId: 1, scheduledAt: 1 });
ScheduleSchema.index({ companyId: 1, status: 1 });
ScheduleSchema.index({ leadId: 1, scheduledAt: -1 });
ScheduleSchema.index({ userId: 1, scheduledAt: 1 });

export const Schedule: Model<ISchedule> =
  mongoose.models.Schedule || mongoose.model<ISchedule>('Schedule', ScheduleSchema);
