'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiFetch, ApiRequestError } from '@/lib/api';
import { useCRMStore } from '@/store/crmStore';

interface BatchState {
  id: string;
  total: number;
  ended: boolean;
  pending?: number;
  scored?: number;
  failed?: number;
}

/** Batches usually land well inside an hour; this is a courteous poll rate. */
const POLL_MS = 15_000;

/**
 * Kicks off scoring for every unscored lead and polls until it lands.
 *
 * The run happens on Anthropic's side, so this survives a page reload only in
 * the sense that the work continues — the poll does not resume. That is a
 * deliberate limit: the scores still get written by whoever polls next, and the
 * alternative is persisting run state the user never asked to track.
 */
export function BulkScoreButton({ enabled }: { enabled: boolean }) {
  const [batch, setBatch] = useState<BatchState | null>(null);
  const [starting, setStarting] = useState(false);
  const { triggerRefresh } = useCRMStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!batch || batch.ended) return;

    const poll = async () => {
      try {
        const next = await apiFetch<BatchState>(`/api/ai/batches/${batch.id}`);
        setBatch(next);
        if (next.ended) {
          toast.success(`Scored ${next.scored ?? 0} lead${next.scored === 1 ? '' : 's'}`);
          triggerRefresh();
        } else {
          timer.current = setTimeout(poll, POLL_MS);
        }
      } catch {
        // A failed poll is not a failed run — the batch is still going. Stop
        // polling rather than showing an error the user can't act on.
        setBatch(null);
      }
    };

    timer.current = setTimeout(poll, POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [batch, triggerRefresh]);

  if (!enabled) return null;

  const start = async () => {
    setStarting(true);
    try {
      const started = await apiFetch<BatchState>('/api/ai/leads/score-batch', { method: 'POST' });
      setBatch(started);
      toast.success(`Scoring ${started.total} leads — this runs in the background`);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not start scoring');
    } finally {
      setStarting(false);
    }
  };

  const running = Boolean(batch && !batch.ended);

  return (
    <button
      onClick={start}
      disabled={starting || running}
      title="Score every lead that has not been scored yet"
      className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-500 hover:text-orange-600 disabled:opacity-60 disabled:cursor-default transition-colors"
    >
      {starting || running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      {running ? `Scoring ${batch!.total} leads…` : starting ? 'Starting…' : 'Score all'}
    </button>
  );
}
