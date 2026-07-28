'use client';

import { apiFetch } from '@/lib/api';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarClock, Loader2, Video, Phone, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Lead } from '@/store/crmStore';
import { cn } from '@/lib/utils';

type SType = 'meeting' | 'call' | 'followup';

interface ScheduleModalProps {
  lead: Lead;
  onClose: () => void;
  onScheduled?: () => void;
}

const TYPES: { value: SType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'meeting', label: 'Meeting', icon: Video, color: '#06b6d4' },
  { value: 'call', label: 'Call', icon: Phone, color: '#3b82f6' },
  { value: 'followup', label: 'Follow-up', icon: CheckCircle2, color: '#8b5cf6' },
];

function defaultWhen() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function ScheduleModal({ lead, onClose, onScheduled }: ScheduleModalProps) {
  const [type, setType] = useState<SType>('meeting');
  const [title, setTitle] = useState(`Meeting with ${lead.name}`);
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
        body: { leadId: lead._id, type, title, scheduledAt, durationMins, location, notes },
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
          className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>

          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl gradient-cyan flex items-center justify-center">
                <CalendarClock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Schedule Activity</h3>
                <p className="text-[11px] text-slate-500">for {lead.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button key={t.value}
                  onClick={() => { setType(t.value); setTitle(`${t.label} with ${lead.name}`); }}
                  className={cn('flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs font-bold border transition-all')}
                  style={{
                    color: t.color,
                    background: type === t.value ? `${t.color}18` : 'rgba(255,255,255,0.03)',
                    borderColor: type === t.value ? t.color : 'transparent',
                  }}>
                  <t.icon className="w-4 h-4" />{t.label}
                </button>
              ))}
            </div>

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

          <div className="px-6 py-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
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
