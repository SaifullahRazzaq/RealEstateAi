import type { ILead } from '../models/Lead.js';
import type { IProperty } from '../models/Property.js';
import { formatArea } from '../lib/area.js';

/**
 * Scores a client's requirement against a property.
 *
 * Deliberately scored rather than filtered. A hard filter on budget hides the
 * plot that is 3% over — which is exactly the one an agent would still ring
 * about, because sellers negotiate. So every dimension contributes a weighted
 * partial score and near-misses come back ranked below exact fits, with the
 * reason attached so the agent can see what to argue about.
 *
 * A dimension the client never specified is not scored at all; it neither
 * helps nor hurts. Scoring an unstated preference as a miss would bury good
 * stock under a requirement the client never expressed.
 */

export interface MatchReason {
  label: string;
  /** `true` when this dimension fits, `false` when it is a near miss. */
  fits: boolean;
}

export interface MatchResult {
  /** 0–100. Only dimensions the client actually stated contribute. */
  score: number;
  reasons: MatchReason[];
}

const WEIGHTS = {
  budget: 35,
  location: 25,
  type: 20,
  area: 20,
};

/**
 * How far over the stated maximum is still worth a phone call. Sellers
 * negotiate, so a plot a little over budget is a real option; past this it is
 * a different bracket and showing it wastes the client's time.
 *
 * The properties query widens by the same figure, so the database never drops
 * a row the scorer would have kept, and never keeps one it would reject.
 */
export const BUDGET_TOLERANCE = 0.15;

/** Full marks inside the range, tapering to zero at `tolerance` outside it. */
function rangeScore(value: number, min: number, max: number, tolerance: number): number {
  if (min > 0 && value < min) {
    const under = min - value;
    return Math.max(0, 1 - under / (min * tolerance));
  }
  if (max > 0 && value > max) {
    const over = value - max;
    return Math.max(0, 1 - over / (max * tolerance));
  }
  return 1;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** "DHA Phase 6" should match a requirement of "dha phase 6" or just "dha". */
function locationMatches(property: IProperty, wanted: string[]): boolean {
  const haystack = norm([property.society, property.block, property.city].filter(Boolean).join(' '));
  return wanted.some((w) => {
    const needle = norm(w);
    return needle.length > 0 && (haystack.includes(needle) || needle.includes(haystack));
  });
}

export function scoreMatch(lead: ILead, property: IProperty): MatchResult {
  const req = lead.requirement;
  const reasons: MatchReason[] = [];

  let earned = 0;
  let available = 0;

  // Budget is a gate, not just another weighted dimension. Averaged in, a
  // plot 60% over budget still scored well on the strength of the other
  // three — the one constraint clients hold to was the one getting diluted.
  if (req?.maxBudget > 0 && property.price > req.maxBudget * (1 + BUDGET_TOLERANCE)) {
    return {
      score: 0,
      reasons: [{
        fits: false,
        label: `${Math.round(((property.price - req.maxBudget) / req.maxBudget) * 100)}% over budget — out of range`,
      }],
    };
  }

  if (req?.maxBudget > 0 || req?.minBudget > 0) {
    available += WEIGHTS.budget;
    const s = rangeScore(property.price, req.minBudget, req.maxBudget, BUDGET_TOLERANCE);
    earned += s * WEIGHTS.budget;
    reasons.push({
      fits: s === 1,
      label: s === 1
        ? 'Within budget'
        : property.price > req.maxBudget && req.maxBudget > 0
          ? `${Math.round(((property.price - req.maxBudget) / req.maxBudget) * 100)}% over budget`
          : 'Below the stated range',
    });
  }

  if (req?.locations?.length) {
    available += WEIGHTS.location;
    const hit = locationMatches(property, req.locations);
    earned += (hit ? 1 : 0) * WEIGHTS.location;
    reasons.push({
      fits: hit,
      label: hit ? `In ${property.society || property.city}` : `Different area — ${property.society || property.city || 'unspecified'}`,
    });
  }

  if (req?.types?.length) {
    available += WEIGHTS.type;
    const hit = req.types.includes(property.type);
    earned += (hit ? 1 : 0) * WEIGHTS.type;
    reasons.push({ fits: hit, label: hit ? `${property.type} as asked` : `${property.type}, not the type asked for` });
  }

  // Area tolerates more than budget: a client asking for 10 marla will look at
  // 12, because the plot is the plot.
  if (req?.minAreaSqft > 0 || req?.maxAreaSqft > 0) {
    available += WEIGHTS.area;
    const s = rangeScore(property.areaSqft, req.minAreaSqft, req.maxAreaSqft, 0.3);
    earned += s * WEIGHTS.area;
    reasons.push({ fits: s === 1, label: s === 1 ? `${formatArea(property.areaSqft)} fits` : `${formatArea(property.areaSqft)} is outside the size asked` });
  }

  // Nothing stated. Say so rather than inventing a number — a 0 would read as
  // a bad match and a 100 as a perfect one, and neither is true.
  if (available === 0) return { score: 0, reasons: [{ fits: false, label: 'No requirement recorded for this lead' }] };

  return { score: Math.round((earned / available) * 100), reasons };
}

/** Ranked best-first. `minScore` keeps obvious noise out of the agent's way. */
export function rankProperties(lead: ILead, properties: IProperty[], minScore = 40) {
  return properties
    .map((property) => ({ property, ...scoreMatch(lead, property) }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

/** The same engine read the other way: who wants this property? */
export function rankLeads(property: IProperty, leads: ILead[], minScore = 40) {
  return leads
    .map((lead) => ({ lead, ...scoreMatch(lead, property) }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
