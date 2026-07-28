import { google } from 'googleapis';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from './apiError.js';

/**
 * Google Meet links cannot be invented — a URL that looks like
 * `meet.google.com/abc-defg-hij` is meaningless unless Google issued it.
 * The only supported way to get one programmatically is to create a Calendar
 * event with a conferenceData request, which is what this module does.
 *
 * Each user connects their own Google account, so the event, the Meet room and
 * any recording belong to the agent who actually ran the meeting.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

export const googleConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI
);

function oauthClient() {
  if (!googleConfigured) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Google Calendar is not configured on this server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI.'
    );
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

/** Step 1 — where we send the user to grant access. */
export function buildConsentUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: 'offline', // needed to receive a refresh token
    prompt: 'consent', // force a refresh token even on re-connect
    scope: SCOPES,
    state,
  });
}

/** Step 2 — exchange the callback code for tokens and store them on the user. */
export async function completeConnection(code: string, userId: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const { data } = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'google.email': data.email,
        'google.accessToken': tokens.access_token,
        'google.refreshToken': tokens.refresh_token,
        'google.expiryDate': tokens.expiry_date,
        'google.connectedAt': new Date(),
      },
    }
  );

  return data.email;
}

/** Returns an authed client for a user, refreshing the access token if needed. */
async function clientForUser(userId: string) {
  const user = await User.findById(userId)
    .select('+google.accessToken +google.refreshToken +google.expiryDate')
    .lean();

  const tokens = (user as { google?: { accessToken?: string; refreshToken?: string; expiryDate?: number } } | null)?.google;
  if (!tokens?.refreshToken) return null;

  const client = oauthClient();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate,
  });

  // googleapis refreshes on demand; persist whatever it hands back.
  client.on('tokens', (fresh) => {
    void User.updateOne(
      { _id: userId },
      {
        $set: {
          ...(fresh.access_token ? { 'google.accessToken': fresh.access_token } : {}),
          ...(fresh.expiry_date ? { 'google.expiryDate': fresh.expiry_date } : {}),
        },
      }
    );
  });

  return client;
}

export interface MeetResult {
  meetingLink: string;
  googleEventId: string;
}

/**
 * Creates a Calendar event with a Meet room attached.
 * Returns null when the user hasn't connected Google, so callers can fall back
 * to a manually pasted link rather than failing the whole request.
 */
export async function createMeetEvent(opts: {
  userId: string;
  title: string;
  description?: string;
  startsAt: Date;
  durationMins: number;
  attendees: string[];
}): Promise<MeetResult | null> {
  if (!googleConfigured) return null;

  const auth = await clientForUser(opts.userId);
  if (!auth) return null;

  const calendar = google.calendar({ version: 'v3', auth });
  const end = new Date(opts.startsAt.getTime() + opts.durationMins * 60000);

  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1, // required, or Google silently skips the Meet room
    sendUpdates: 'all', // email the lead their invite
    requestBody: {
      summary: opts.title,
      description: opts.description,
      start: { dateTime: opts.startsAt.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: opts.attendees.filter(Boolean).map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const link =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;

  if (!link || !data.id) return null;
  return { meetingLink: link, googleEventId: data.id };
}

/** Keeps the Calendar event in step when a meeting is rescheduled or cancelled. */
export async function updateMeetEvent(opts: {
  userId: string;
  eventId: string;
  startsAt?: Date;
  durationMins?: number;
  cancelled?: boolean;
}): Promise<void> {
  if (!googleConfigured) return;
  const auth = await clientForUser(opts.userId);
  if (!auth) return;

  const calendar = google.calendar({ version: 'v3', auth });

  if (opts.cancelled) {
    await calendar.events.delete({ calendarId: 'primary', eventId: opts.eventId, sendUpdates: 'all' });
    return;
  }

  if (opts.startsAt) {
    const end = new Date(opts.startsAt.getTime() + (opts.durationMins ?? 30) * 60000);
    await calendar.events.patch({
      calendarId: 'primary',
      eventId: opts.eventId,
      sendUpdates: 'all',
      requestBody: {
        start: { dateTime: opts.startsAt.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
  }
}

export async function isConnected(userId: string): Promise<boolean> {
  const user = await User.findById(userId).select('+google.refreshToken').lean();
  return Boolean((user as { google?: { refreshToken?: string } } | null)?.google?.refreshToken);
}

export async function disconnect(userId: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $unset: { google: '' } });
}
