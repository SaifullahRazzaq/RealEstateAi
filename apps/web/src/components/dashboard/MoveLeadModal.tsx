'use client';

import { apiFetch } from '@/lib/api';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, AlertTriangle, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Lead, LeadStatus, CommissionSide, STATUS_META, MOVE_TARGETS, DATED_STATUS_FIELD } from '@/store/crmStore';
import { cn, formatPKR } from '@/lib/utils';

/** Today in the yyyy-mm-dd shape a date input wants, in local time. */
function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Local-time yyyy-mm-dd, so a date picked here isn't shifted a day by UTC. */
function toLocalDateInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const STAGE_DATE_COPY: Record<string, { label: string; hint: string }> = {
  dailytask: {
    label: 'Task date',
    hint: 'Daily Task is read one day at a time — this is the day the lead shows up on.',
  },
  meeting: {
    label: 'Meeting date',
    hint: 'The day this lead appears under Meetings. Set the exact time later with Schedule.',
  },
};

interface MoveLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onMoved: (updated: Lead) => void;
}

export function MoveLeadModal({ lead, onClose, onMoved }: MoveLeadModalProps) {
  const [target, setTarget] = useState<LeadStatus | null>(null);
  const [note, setNote] = useState('');
  // One field for both dated stages — only ever one is on screen at a time,
  // and pre-filling with today makes the common "chase tomorrow" case one tap.
  const [stageDate, setStageDate] = useState<string>(todayISO());
  const [wonValue, setWonValue] = useState<string>(String(lead.dealValue || ''));
  const [tokenAmount, setTokenAmount] = useState<string>(String(lead.tokenAmount || ''));
  const [transferDate, setTransferDate] = useState<string>(
    lead.expectedTransferDate ? lead.expectedTransferDate.slice(0, 10) : ''
  );
  const [rate, setRate] = useState<string>(String(lead.commission?.rate ?? 1));
  const [side, setSide] = useState<CommissionSide>(lead.commission?.side ?? 'both');
  const [dealerShare, setDealerShare] = useState<string>(String(lead.commission?.dealerSharePercent ?? 0));
  const [saving, setSaving] = useState(false);

  /** Mirrors the server's rule so the agent sees the fee before committing. */
  const previewCommission = (base: number) => {
    const gross = Math.round(base * ((Number(rate) || 0) / 100) * (side === 'both' ? 2 : 1));
    return { gross, net: Math.round(gross * (1 - (Number(dealerShare) || 0) / 100)) };
  };

  const dateField = target ? DATED_STATUS_FIELD[target] : undefined;
  // A dated stage with no date puts the lead on no list at all, so the move is
  // blocked here rather than letting the server bounce it.
  const ready = Boolean(target) && (!dateField || Boolean(stageDate));

  const confirmMove = async () => {
    if (!target || !ready) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { status: target, moveNote: note };

      if (dateField) payload[dateField] = stageDate;

      if (target === 'token') {
        payload.tokenAmount = Number(tokenAmount) || 0;
        if (transferDate) payload.expectedTransferDate = transferDate;
      }

      if (target === 'won') payload.wonValue = Number(wonValue) || lead.dealValue || 0;

      // Commission is settled at the two stages where money is actually
      // agreed, so the figure is captured while the agent still has it.
      if (target === 'token' || target === 'won') {
        payload.commission = {
          rate: Number(rate) || 0,
          side,
          dealerSharePercent: Number(dealerShare) || 0,
        };
      }

      const res = await apiFetch<{ lead: Lead }>(`/api/leads/${lead._id}`, {
        method: 'PATCH',
        body: payload,
      });
      toast.success(`Moved to ${STATUS_META[target].label}`);
      onMoved(res.lead);
      onClose();
    } catch {
      toast.error('Failed to move lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
          {/* Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl gradient-blue flex items-center justify-center text-white font-bold flex-shrink-0">
                {lead.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Move Lead</h3>
                <p className="text-[11px] text-slate-500 truncate">{lead.name} · currently {STATUS_META[lead.status].label}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* The body scrolls, so the confirm buttons stay reachable on a phone
              even with the won-value field and the warning banner both showing. */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-5">
            {/* Status grid */}
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3">Move to</p>
              <div className="grid grid-cols-2 gap-2">
                {MOVE_TARGETS.filter((s) => s !== lead.status).map((s) => {
                  const meta = STATUS_META[s];
                  const active = target === s;
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        setTarget(s);
                        // Reuse a date the lead already carries for that stage,
                        // so re-dating an existing task starts from where it is.
                        const field = DATED_STATUS_FIELD[s];
                        if (field) setStageDate(toLocalDateInput(lead[field]) || todayISO());
                      }}
                      className={cn('flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-3 rounded-2xl text-xs font-bold border transition-all min-w-0')}
                      style={{
                        color: meta.color,
                        background: active ? `${meta.color}18` : '#f8fafc',
                        borderColor: active ? meta.color : 'transparent',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                      <span className="truncate">{meta.label}</span>
                      {active && <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* The dated stages. Required, because Daily Task and Meetings are
                both read a day at a time — an undated lead lands nowhere. */}
            {target && dateField && (
              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">
                  {STAGE_DATE_COPY[target].label} <span className="text-orange-500">*</span>
                </p>
                <input type="date" value={stageDate} onChange={(e) => setStageDate(e.target.value)}
                  className="input-field text-xs" style={{ colorScheme: 'light' }} />
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{STAGE_DATE_COPY[target].hint}</p>
              </div>
            )}

            {/* Token — bayana taken, transfer pending */}
            {target === 'token' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Token / bayana (PKR)</p>
                  <input type="number" value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)}
                    placeholder="0" className="input-field" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Expected transfer</p>
                  <input type="date" value={transferDate} min={todayISO()}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="input-field text-xs" style={{ colorScheme: 'light' }} />
                </div>
              </div>
            )}

            {/* Commission — the agency's actual income, settled here */}
            {(target === 'token' || target === 'won') && (
              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Commission</p>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="text-[9px] text-slate-500 font-semibold">Rate % / side</span>
                    <input type="number" step="0.25" value={rate} onChange={(e) => setRate(e.target.value)} className="input-field mt-1" />
                  </label>
                  <label className="block">
                    <span className="text-[9px] text-slate-500 font-semibold">Side</span>
                    <select value={side} onChange={(e) => setSide(e.target.value as CommissionSide)} className="input-field mt-1">
                      <option value="both">Both</option>
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[9px] text-slate-500 font-semibold">Dealer share %</span>
                    <input type="number" value={dealerShare} onChange={(e) => setDealerShare(e.target.value)} className="input-field mt-1" />
                  </label>
                </div>
                {(() => {
                  const base = target === 'won' ? Number(wonValue) || 0 : lead.dealValue || 0;
                  const { gross, net } = previewCommission(base);
                  return (
                    <p className="text-[11px] text-slate-600 mt-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                      Sale {formatPKR(base)} → agency earns <b className="text-green-700">{formatPKR(net)}</b>
                      {net !== gross && <span className="text-slate-500"> (of {formatPKR(gross)}, rest to the dealer)</span>}
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Won value */}
            {target === 'won' && (
              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Sale price realised (PKR)</p>
                <input type="number" value={wonValue} onChange={(e) => setWonValue(e.target.value)}
                  placeholder="0" className="input-field" />
              </div>
            )}

            {/* Optional note */}
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Note (optional)</p>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for this move…" className="input-field" />
            </div>

            {/* Confirmation banner */}
            {target && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Are you sure? This will move <b className="text-slate-900">{lead.name}</b> from{' '}
                  <span className="font-bold" style={{ color: STATUS_META[lead.status].color }}>{STATUS_META[lead.status].label}</span>
                  {' '}<ArrowRight className="w-3 h-3 inline" />{' '}
                  <span className="font-bold" style={{ color: STATUS_META[target].color }}>{STATUS_META[target].label}</span>.
                </p>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={confirmMove} disabled={!ready || saving}
              className="btn-primary flex-1 justify-center disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm Move
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
