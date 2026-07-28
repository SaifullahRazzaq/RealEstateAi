'use client';

import { apiFetch } from '@/lib/api';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, AlertTriangle, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Lead, LeadStatus, STATUS_META } from '@/store/crmStore';
import { cn } from '@/lib/utils';

const ORDER: LeadStatus[] = ['new', 'incontact', 'followedup', 'due', 'meeting', 'won', 'lost'];

interface MoveLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onMoved: (updated: Lead) => void;
}

export function MoveLeadModal({ lead, onClose, onMoved }: MoveLeadModalProps) {
  const [target, setTarget] = useState<LeadStatus | null>(null);
  const [note, setNote] = useState('');
  const [wonValue, setWonValue] = useState<string>(String(lead.dealValue || ''));
  const [saving, setSaving] = useState(false);

  const confirmMove = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { status: target, moveNote: note };
      if (target === 'won') payload.wonValue = Number(wonValue) || lead.dealValue || 0;

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
          className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl gradient-blue flex items-center justify-center text-white font-bold">
                {lead.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Move Lead</h3>
                <p className="text-[11px] text-slate-500">{lead.name} · currently {STATUS_META[lead.status].label}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Status grid */}
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3">Move to</p>
              <div className="grid grid-cols-2 gap-2">
                {ORDER.filter((s) => s !== lead.status).map((s) => {
                  const meta = STATUS_META[s];
                  const active = target === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setTarget(s)}
                      className={cn('flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-bold border transition-all')}
                      style={{
                        color: meta.color,
                        background: active ? `${meta.color}18` : 'rgba(255,255,255,0.03)',
                        borderColor: active ? meta.color : 'transparent',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                      {meta.label}
                      {active && <Check className="w-3.5 h-3.5 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Won value */}
            {target === 'won' && (
              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Deal value received ($)</p>
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
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  Are you sure? This will move <b className="text-slate-900">{lead.name}</b> from{' '}
                  <span className="font-bold" style={{ color: STATUS_META[lead.status].color }}>{STATUS_META[lead.status].label}</span>
                  {' '}<ArrowRight className="w-3 h-3 inline" />{' '}
                  <span className="font-bold" style={{ color: STATUS_META[target].color }}>{STATUS_META[target].label}</span>.
                </p>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={confirmMove} disabled={!target || saving}
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
