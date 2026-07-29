import type { ILead } from '../models/Lead.js';
import { structuredCall } from '../lib/ai.js';
import { buildLeadContext } from './leadScoring.js';

export interface LeadSummary {
  /** The one line an agent reads while the phone is ringing. */
  headline: string;
  /** 2-4 sentences of where things actually stand. */
  summary: string;
  /** What is known, worth repeating back to the lead. */
  keyFacts: string[];
  /** What the record does not answer yet and the agent should ask. */
  openQuestions: string[];
}

const SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    keyFacts: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['headline', 'summary', 'keyFacts', 'openQuestions'],
  additionalProperties: false,
};

const SYSTEM = `You brief a real estate agent on a lead in the seconds before they
call. The agent has not read the file. Write what they need in their head.

Rules:
- Use only the record given. Never invent a budget, a property, a preference, or
  a conversation that is not there. An empty record produces a short brief, not
  a padded one.
- headline: one line, under 12 words, stating who this is and the single most
  important thing about them right now.
- summary: 2-4 sentences on where the relationship stands — what has happened,
  how recently, and what is blocking progress. Plain sentences, no bullet
  formatting, no headers.
- keyFacts: at most 5, each a short phrase the agent can repeat back to the
  lead. Only facts present in the record.
- openQuestions: at most 4, the things the record does not answer that the agent
  should ask on this call. This is where a thin record shows up — say what is
  missing rather than guessing at it.
- Write for someone who knows real estate. Do not explain the pipeline stages
  back to them, and do not give generic sales coaching.`;

export async function summarizeLead(lead: ILead): Promise<LeadSummary> {
  const context = await buildLeadContext(lead);
  return structuredCall<LeadSummary>({
    system: SYSTEM,
    prompt: `Brief the agent on this lead.\n\nName: ${lead.name}\n${context}`,
    schema: SCHEMA,
  });
}
