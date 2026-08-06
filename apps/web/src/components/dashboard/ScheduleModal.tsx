'use client';

import { apiFetch } from '@/lib/api';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarClock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Lead, STATUS_META } from '@/store/crmStore';

interface ScheduleModalProps {
  lead: Lead;
  onClose: () => void;
  onScheduled?: () => void;
}

function defaultWhen() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function ScheduleModal({ lead, onClose, onScheduled }: ScheduleModalProps) {
  const [title, setTitle] = useState(`${STATUS_META[lead.status].label} with ${lead.name}`);
  const [scheduledAt, setScheduledAt] = useState(defaultWhen());
  const [durationMins, setDurationMins] = useState(30);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title || !scheduledAt) { toast.error('Title and date/time are required'); return; }
    setSaving(true);
    try {
      await apiFetch<{ schedule: unknown }>('/api/schedule', {
        method: 'POST',
        body: { leadId: lead._id, title, scheduledAt, durationMins, location, notes },
      });
      toast.success('Scheduled successfully');
      onScheduled?.();
      onClose();
    } catch {
      toast.error('Failed to schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }} onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>

          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl gradient-cyan flex items-center justify-center flex-shrink-0">
                <CalendarClock className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Schedule Activity</h3>
                <p className="text-[11px] text-slate-500 truncate">for {lead.name}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
            {/* A schedule is just the lead's next dated commitment now — the
                stage it sits in already says what kind of contact it is, so
                asking for meeting/call/follow-up again only invited them to
                disagree. Scheduling never moves the lead; the agent does. */}
            <p className="text-[11px] text-slate-600 leading-relaxed px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
              Sets the next date for <b className="text-slate-900">{lead.name}</b>, currently in{' '}
              <span className="font-bold" style={{ color: STATUS_META[lead.status].color }}>
                {STATUS_META[lead.status].label}
              </span>. The stage stays as it is — use Move Lead to change it.
            </p>

            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Title</p>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Date &amp; Time</p>
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                  className="input-field text-xs" style={{ colorScheme: 'light' }} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Duration (min)</p>
                <input type="number" value={durationMins} onChange={(e) => setDurationMins(Number(e.target.value))} className="input-field" />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Location / Link (optional)</p>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office, Zoom link, phone…" className="input-field" />
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">Notes (optional)</p>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-field resize-none" />
            </div>
          </div>

          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={submit} disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              Schedule
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
