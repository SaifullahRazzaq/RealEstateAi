'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiFetch, ApiRequestError } from '@/lib/api';
import { LeadAI } from '@/store/crmStore';
import { cn } from '@/lib/utils';

/** Band drives the whole panel's colour, so the three live in one place. */
export const BAND_META: Record<LeadAI['band'], { label: string; text: string; bg: string; ring: string }> = {
  hot: { label: 'Hot', text: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-200' },
  warm: { label: 'Warm', text: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  cold: { label: 'Cold', text: 'text-sky-600', bg: 'bg-sky-50', ring: 'ring-sky-200' },
};

/** A score older than this is probably out of date after a week of activity. */
const STALE_AFTER_DAYS = 7;

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Whether this deployment has an ANTHROPIC_API_KEY. Without it the AI controls
 * are hidden rather than shown and then failing on click.
 */
export function useAIEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    apiFetch<{ configured: boolean }>('/api/ai/status')
      .then((r) => setEnabled(r.configured))
      .catch(() => setEnabled(false));
  }, []);
  return enabled;
}

interface Props {
  leadId: string;
  ai?: LeadAI;
  /** Whether the server has an ANTHROPIC_API_KEY — hides the control if not. */
  enabled: boolean;
  onScored: (ai: LeadAI) => void;
}

export function AIScorePanel({ leadId, ai, enabled, onScored }: Props) {
  const [loading, setLoading] = useState(false);

  // Nothing to show and nothing to offer — don't render a dead control.
  if (!enabled && !ai) return null;

  const run = async () => {
    setLoading(true);
    try {
      const result = await apiFetch<LeadAI>(`/api/ai/leads/${leadId}/score`, { method: 'POST' });
      onScored(result);
      toast.success('Lead scored');
    } catch (err) {
      // The API distinguishes "not configured" and "rate limited" from a real
      // failure; passing its message through is more useful than a generic one.
      toast.error(err instanceof ApiRequestError ? err.message : 'Scoring failed');
    } finally {
      setLoading(false);
    }
  };

  const band = ai ? BAND_META[ai.band] : null;
  const age = ai ? daysAgo(ai.scoredAt) : 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">AI Score</p>
        {enabled && (
          <button
            onClick={run}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-500 hover:text-orange-600 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : ai ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {loading ? 'Scoring…' : ai ? 'Re-score' : 'Score this lead'}
          </button>
        )}
      </div>

      {!ai ? (
        <p className="text-xs text-slate-500 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
          Not scored yet. Scoring reads this lead&apos;s notes, calls and pipeline history.
        </p>
      ) : (
        <div className={cn('rounded-2xl border border-slate-200 overflow-hidden', band!.bg)}>
          <div className="flex items-center gap-4 px-4 py-3">
            <div className={cn('flex items-baseline gap-1 ring-1 rounded-xl px-3 py-1.5 bg-white', band!.ring)}>
              <span className={cn('text-2xl font-bold tabular-nums', band!.text)}>{ai.score}</span>
              <span className="text-[10px] text-slate-400 font-semibold">/100</span>
            </div>
            <div className="min-w-0">
              <p className={cn('text-sm font-bold', band!.text)}>{band!.label}</p>
              <p className="text-[10px] text-slate-500">
                Scored {age === 0 ? 'today' : `${age}d ago`}
                {age >= STALE_AFTER_DAYS && ' · may be out of date'}
              </p>
            </div>
          </div>

          <div className="px-4 pb-4 space-y-3 bg-white/60">
            <p className="text-xs text-slate-700 leading-relaxed pt-3">{ai.reasoning}</p>

            <div className="rounded-xl bg-white px-3 py-2 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Next action</p>
              <p className="text-xs text-slate-800 font-medium">{ai.nextAction}</p>
            </div>

            {(ai.signals.positive.length > 0 || ai.signals.negative.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {ai.signals.positive.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                    <ThumbsUp className="w-2.5 h-2.5" />
                    {s}
                  </span>
                ))}
                {ai.signals.negative.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                    <ThumbsDown className="w-2.5 h-2.5" />
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Compact score chip for list rows. */
export function AIScoreBadge({ ai }: { ai?: LeadAI }) {
  if (!ai) return null;
  const band = BAND_META[ai.band];
  return (
    <span
      title={`${band.label} · ${ai.reasoning}`}
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1', band.bg, band.text, band.ring)}
    >
      <Sparkles className="w-2.5 h-2.5" />
      {ai.score}
    </span>
  );
}
