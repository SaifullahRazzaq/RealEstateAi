import { Call } from '../models/Call.js';
import { Comment } from '../models/Comment.js';
import type { ILead } from '../models/Lead.js';
import { createStructuredBatch, structuredCall } from '../lib/ai.js';

export interface LeadScore {
  /** 0–100. Higher means likelier to close. */
  score: number;
  band: 'hot' | 'warm' | 'cold';
  /** Why this score — shown to the agent, so it must cite the record. */
  reasoning: string;
  /** What the agent should do next, concretely. */
  nextAction: string;
  signals: { positive: string[]; negative: string[] };
}

const SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer' },
    band: { type: 'string', enum: ['hot', 'warm', 'cold'] },
    reasoning: { type: 'string' },
    nextAction: { type: 'string' },
    signals: {
      type: 'object',
      properties: {
        positive: { type: 'array', items: { type: 'string' } },
        negative: { type: 'array', items: { type: 'string' } },
      },
      required: ['positive', 'negative'],
      additionalProperties: false,
    },
  },
  required: ['score', 'band', 'reasoning', 'nextAction', 'signals'],
  additionalProperties: false,
};

const SYSTEM = `You score real estate CRM leads on how likely they are to close.

Score 0-100 and map it to a band: 0-39 cold, 40-69 warm, 70-100 hot.

What moves a score up: recent two-way contact, a lead that has advanced through
the pipeline rather than sitting still, a deal value that is realistic for the
source, notes describing a specific requirement or budget, meetings booked.

What moves it down: no contact logged, long gaps since the last activity, an
overdue follow-up date, a status that has not changed in weeks, notes describing
hesitation or a mismatch with what the agent can offer.

Rules:
- Judge only from the record given. Never invent a conversation, a budget, or an
  intention that is not in the data.
- A sparse record is not a bad lead, it is an unknown one. Score it near the
  middle and say the record is thin rather than scoring it cold.
- reasoning: 2-3 sentences, referring to what is actually in the record.
- nextAction: one concrete step this agent can take this week, not generic
  advice. "Call to confirm the 3-bed budget she mentioned on 12 Mar", not
  "follow up with the lead".
- signals: short phrases, at most 4 each. Use an empty array when there are none
  rather than inventing filler.`;

const daysSince = (d?: Date | null) =>
  d ? Math.round((Date.now() - new Date(d).getTime()) / 86_400_000) : null;

/**
 * Builds the record Claude reasons over. Deliberately a plain readable summary
 * rather than raw JSON of the mongoose document: the model does better with
 * "last contacted 34 days ago" than with an ISO timestamp it has to subtract,
 * and it keeps internal ids and tenant fields out of the prompt entirely.
 *
 * Exported because every per-lead AI feature wants this same view — scoring
 * today, summarization and follow-up drafting next — and they must agree on
 * what the model is allowed to see.
 */
export async function buildLeadContext(lead: ILead): Promise<string> {
  const [comments, callCount, lastCall] = await Promise.all([
    Comment.find({ leadId: lead._id }).sort({ createdAt: -1 }).limit(10).lean(),
    Call.countDocuments({ leadId: lead._id }),
    Call.findOne({ leadId: lead._id }).sort({ createdAt: -1 }).lean(),
  ]);

  const lines: string[] = [
    `Status: ${lead.status}`,
    `Source: ${lead.source || 'unknown'}`,
    // Currency stated explicitly: an unlabelled "8,500,000" reads as a wildly
    // different deal depending on the unit the model assumes, and that number
    // is part of what it scores on.
    `Expected deal value: ${lead.dealValue ? `PKR ${lead.dealValue.toLocaleString('en-PK')}` : 'not set'}`,
    `Created: ${daysSince(lead.createdAt)} days ago`,
    `Last updated: ${daysSince(lead.updatedAt)} days ago`,
    `In pipeline: ${lead.isPipeline ? 'yes' : 'no'}`,
  ];

  if (lead.company) lines.push(`Company: ${lead.company}`);

  if (lead.followUpDate) {
    const d = daysSince(lead.followUpDate);
    lines.push(
      d !== null && d > 0
        ? `Follow-up was due ${d} days ago and has not been actioned`
        : `Follow-up scheduled in ${Math.abs(d ?? 0)} days`
    );
  } else {
    lines.push('No follow-up scheduled');
  }

  if (lead.meetingDate) lines.push(`Meeting on record: ${lead.meetingDate.toISOString().slice(0, 10)}`);

  lines.push(
    callCount > 0
      ? `Calls logged: ${callCount}, most recent ${daysSince(lastCall?.createdAt)} days ago`
      : 'Calls logged: none'
  );

  // No-op transitions (from === to) get written on edits that don't change
  // status; they carry no signal and reading "new->new" as movement would skew
  // the score upward.
  const moves = (lead.statusHistory ?? []).filter((h) => h.from !== h.to);
  lines.push(
    moves.length > 0
      ? `Pipeline movement: ${moves.map((h) => `${h.from}->${h.to}`).join(', ')}`
      : 'Pipeline movement: none since creation'
  );

  lines.push(
    comments.length > 0
      ? `\nAgent notes, newest first:\n${comments
          .map((c) => `- (${daysSince(c.createdAt)}d ago) ${c.comment}`)
          .join('\n')}`
      : '\nAgent notes: none'
  );

  return lines.join('\n');
}

/** The one place the scoring request is described, so live and batch agree. */
async function scoringRequest(lead: ILead) {
  return {
    system: SYSTEM,
    prompt: `Score this lead.\n\n${await buildLeadContext(lead)}`,
    schema: SCHEMA,
  };
}

export async function scoreLead(lead: ILead): Promise<LeadScore> {
  return structuredCall<LeadScore>(await scoringRequest(lead));
}

/**
 * Submits a scoring run for many leads at once and returns the batch id.
 *
 * Each request is tagged with its lead id, which is what the results are keyed
 * on when they come back — batch results arrive in arbitrary order, so position
 * means nothing.
 */
export async function scoreLeadsBatch(leads: ILead[]): Promise<string> {
  const requests = await Promise.all(
    leads.map(async (lead) => ({ customId: String(lead._id), ...(await scoringRequest(lead)) }))
  );
  return createStructuredBatch(requests);
}
