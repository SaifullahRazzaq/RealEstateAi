'use client';

import { useState } from 'react';
import { FileText, Loader2, HelpCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiFetch, ApiRequestError } from '@/lib/api';

export interface LeadSummary {
  headline: string;
  summary: string;
  keyFacts: string[];
  openQuestions: string[];
}

interface Props {
  leadId: string;
  enabled: boolean;
}

/**
 * On-demand brief for the lead currently open.
 *
 * Held in local state rather than the store or the lead document: the API does
 * not persist it either, because a brief that lags the newest note is worse
 * than no brief. Switching leads unmounts this panel and the summary goes with
 * it, which is the intended lifetime.
 */
export function AISummaryPanel({ leadId, enabled }: Props) {
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [loading, setLoading] = useState(false);

  if (!enabled) return null;

  const run = async () => {
    setLoading(true);
    try {
      setSummary(await apiFetch<LeadSummary>(`/api/ai/leads/${leadId}/summary`, { method: 'POST' }));
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not build the brief');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Call Brief</p>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-500 hover:text-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : summary ? (
            <RefreshCw className="w-3.5 h-3.5" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
          {loading ? 'Reading the file…' : summary ? 'Refresh' : 'Brief me'}
        </button>
      </div>

      {!summary ? (
        <p className="text-xs text-slate-500 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
          Builds a short brief from this lead&apos;s notes and history — read it before you call.
        </p>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <p className="text-sm font-bold text-slate-900">{summary.headline}</p>
          </div>

          <div className="px-4 py-3 space-y-3">
            <p className="text-xs text-slate-700 leading-relaxed">{summary.summary}</p>

            {summary.keyFacts.length > 0 && (
              <ul className="space-y-1">
                {summary.keyFacts.map((f) => (
                  <li key={f} className="flex gap-2 text-xs text-slate-700">
                    <span className="text-orange-400 shrink-0">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            )}

            {summary.openQuestions.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">
                  <HelpCircle className="w-3 h-3" />
                  Ask about
                </p>
                <ul className="space-y-1">
                  {summary.openQuestions.map((q) => (
                    <li key={q} className="text-xs text-amber-900">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
