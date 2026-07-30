'use client';

import { apiFetch } from '@/lib/api';
import { useEffect, useState, useRef } from 'react';
import {
  X, Phone, Send, Loader2, Video, MessageCircle, Hash, Clock,
  ArrowRightLeft, CalendarPlus, Banknote, Mail, Building2, Star, StickyNote,
} from 'lucide-react';
import { useCRMStore, Comment, Lead, STATUS_META } from '@/store/crmStore';
import { formatDate, formatDateTime, formatPhone, formatPKR, cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { MoveLeadModal } from './MoveLeadModal';
import { ScheduleModal } from './ScheduleModal';
import { AIScorePanel, useAIEnabled } from './AIScorePanel';
import { AISummaryPanel } from './AISummaryPanel';
import { ContactActionBar } from './ContactActions';
import { WhatsAppComposer } from './WhatsAppComposer';

export function LeadDrawer() {
  const {
    selectedLead, setSelectedLead, drawerOpen, setDrawerOpen,
    comments, setComments, leads, setLeads, triggerRefresh,
  } = useCRMStore();
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [dealValue, setDealValue] = useState('');
  // The footer does double duty: an internal note, or a WhatsApp message out.
  const [composer, setComposer] = useState<'note' | 'whatsapp'>('note');
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const aiEnabled = useAIEnabled();

  useEffect(() => {
    if (selectedLead) {
      fetchComments();
      setDealValue(String(selectedLead.dealValue || ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?._id]);

  const fetchComments = async () => {
    if (!selectedLead) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ comments: Comment[] }>(`/api/leads/${selectedLead._id}/comments`);
      setComments(data.comments || []);
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const patchLead = async (updates: Record<string, unknown>) => {
    if (!selectedLead) return;
    try {
      const res = await apiFetch<{ lead: Lead }>(`/api/leads/${selectedLead._id}`, {
        method: 'PATCH',
        body: updates,
      });
      applyUpdated(res.lead);
      toast.success('Lead updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const applyUpdated = (updated: Lead) => {
    setLeads(leads.map((l) => (l._id === updated._id ? { ...l, ...updated } : l)));
    setSelectedLead({ ...(selectedLead as Lead), ...updated });
    triggerRefresh();
  };

  /** A message that never reaches the timeline is a call nobody can follow up on. */
  const logWhatsApp = async (message: string) => {
    if (!selectedLead) return;
    try {
      const res = await apiFetch<{ comment: Comment }>(`/api/leads/${selectedLead._id}/comments`, {
        method: 'POST',
        body: { comment: `WhatsApp sent — ${message}`, logCall: false },
      });
      setComments([res.comment, ...comments]);
    } catch {
      toast.error('WhatsApp opened, but logging the message failed');
    }
  };

  if (!drawerOpen || !selectedLead) return null;
  const meta = STATUS_META[selectedLead.status];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-40 backdrop-blur-md"
        onClick={() => { setDrawerOpen(false); setSelectedLead(null); }} />

      {/* Full-bleed on a phone — a 460px panel leaves a useless sliver of the
          page behind it and shrinks every control inside. */}
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-dvh w-full sm:w-[460px] z-50 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>

        {/* Header */}
        {/* The drawer starts at the very top of the screen, so the header owes
            the notch its inset — nothing above it will pay it. The inline
            padding-top beats any `pt-*` class, so there is deliberately none. */}
        <div
          className="flex-shrink-0 px-4 sm:px-6 pb-4 sm:pb-6 border-b bg-slate-50"
          style={{ borderColor: 'var(--border)', paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl gradient-blue flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-xl shadow-orange-500/20 flex-shrink-0">
                {selectedLead.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">{selectedLead.name}</h2>
                  {selectedLead.isPipeline && <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />}
                </div>
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
                  <span className={cn('badge', meta.badge)}>{meta.label}</span>
                  {selectedLead.company && <span className="text-[11px] text-slate-500 truncate">{selectedLead.company}</span>}
                </div>
              </div>
            </div>
            <button onClick={() => { setDrawerOpen(false); setSelectedLead(null); }}
              aria-label="Close lead"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Primary actions: Move + Schedule */}
          <div className="flex gap-2 mb-2">
            <button onClick={() => setShowMove(true)} className="flex-1 btn-primary py-2.5 rounded-xl gap-2 text-xs justify-center">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Move Lead
            </button>
            <button onClick={() => setShowSchedule(true)}
              className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all"
              style={{ background: 'rgba(6,182,212,0.12)', color: '#0e7490', border: '1px solid rgba(6,182,212,0.25)' }}>
              <CalendarPlus className="w-3.5 h-3.5" /> Schedule
            </button>
          </div>

          {/* Call / WhatsApp / SMS — links, so a phone hands them to the right app */}
          <ContactActionBar contact={selectedLead} />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6 sm:space-y-7 custom-scrollbar">
          {/* Contact details */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Detail icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={formatPhone(selectedLead.phone)} />
            <Detail icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={selectedLead.email || '—'} />
            <Detail icon={<Building2 className="w-3.5 h-3.5" />} label="Company" value={selectedLead.company || '—'} />
            <Detail icon={<Hash className="w-3.5 h-3.5" />} label="Source" value={selectedLead.source || '—'} />
          </section>

          {/* AI score — above the deal value, since it's what tells you whether
              that number is worth chasing. */}
          <AIScorePanel
            leadId={selectedLead._id}
            ai={selectedLead.ai}
            enabled={aiEnabled}
            onScored={(ai) => applyUpdated({ ...selectedLead, ai })}
          />

          {/* Keyed on the lead so switching leads discards the previous brief
              rather than showing it against the wrong person. */}
          <AISummaryPanel key={selectedLead._id} leadId={selectedLead._id} enabled={aiEnabled} />

          {/* Token — only meaningful once bayana has actually been taken */}
          {(selectedLead.status === 'token' || selectedLead.tokenAmount > 0) && (
            <section className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.18)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-teal-700 uppercase font-bold tracking-wider">Token received</p>
                  <p className="text-sm font-bold text-slate-900">{formatPKR(selectedLead.tokenAmount)}</p>
                </div>
                {selectedLead.expectedTransferDate && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Transfer</p>
                    <p className="text-xs font-semibold text-slate-900">{formatDate(selectedLead.expectedTransferDate)}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Commission — what the agency actually earns on this deal */}
          <section>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3">Agency Commission</p>
            <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-bold text-green-700">{formatPKR(selectedLead.commission?.net ?? 0)}</span>
                <span className="text-[11px] text-slate-500">
                  {selectedLead.commission?.rate ?? 0}% · {selectedLead.commission?.side ?? 'both'}
                </span>
              </div>
              {(selectedLead.commission?.dealerSharePercent ?? 0) > 0 && (
                <p className="text-[11px] text-slate-500 mt-1">
                  {formatPKR(selectedLead.commission.gross)} gross · {selectedLead.commission.dealerSharePercent}% to dealer
                </p>
              )}
              <p className="text-[10px] text-slate-500 mt-2">Set when the lead is moved to Token or Won.</p>
            </div>
          </section>

          {/* Deal value */}
          <section>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3">Sale Price (PKR)</p>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              <input type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)}
                onBlur={() => { if (Number(dealValue) !== selectedLead.dealValue) patchLead({ dealValue: Number(dealValue) || 0 }); }}
                placeholder="0" className="input-field pl-10" />
            </div>
            {selectedLead.status === 'won' && selectedLead.wonValue > 0 && (
              <p className="text-[11px] text-green-600 font-bold mt-2">✓ Collected {formatPKR(selectedLead.wonValue)}</p>
            )}
          </section>

          {/* Pipeline toggle + meeting date */}
          <section className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 min-w-0">
              <Star className={cn('w-4 h-4 flex-shrink-0', selectedLead.isPipeline ? 'text-amber-400 fill-amber-400' : 'text-slate-400')} />
              <span className="text-xs font-semibold text-slate-700">Mark as Pipeline (hot)</span>
            </div>
            <button onClick={() => patchLead({ isPipeline: !selectedLead.isPipeline })}
              aria-label="Toggle pipeline"
              className={cn('w-11 h-6 rounded-full transition-all relative flex-shrink-0', selectedLead.isPipeline ? 'bg-amber-500' : 'bg-slate-300')}>
              <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', selectedLead.isPipeline ? 'left-[22px]' : 'left-0.5')} />
            </button>
          </section>

          {selectedLead.meetingDate && (
            <section className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}>
              <Video className="w-4 h-4 text-cyan-400" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Next Meeting</p>
                <p className="text-xs font-semibold text-slate-900">{formatDateTime(selectedLead.meetingDate)}</p>
              </div>
            </section>
          )}

          {/* Activity timeline */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Activity Timeline</p>
              <span className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-bold">{comments.length} Log{comments.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100">
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-slate-600 pl-8 py-2">No activity yet. Add a note below.</p>
              ) : comments.map((comment, i) => (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  key={comment._id} className="relative pl-8">
                  <div className="absolute left-0 top-1.5 w-[23px] h-[23px] rounded-full border-4 border-white bg-slate-100 flex items-center justify-center">
                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-orange-500">{typeof comment.userId === 'object' ? comment.userId.name : 'System'}</span>
                      <span className="text-[10px] text-slate-500">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap break-words">{comment.comment}</p>
                  </div>
                </motion.div>
              ))}
              <div ref={commentsEndRef} />
            </div>
          </section>
        </div>

        {/* Composer — an internal note, or a WhatsApp message to the client.
            The bottom inset keeps the send button clear of the home indicator. */}
        <div
          className="flex-shrink-0 px-4 sm:px-6 pt-3 border-t bg-slate-50"
          style={{ borderColor: 'var(--border)', paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-1 p-1 mb-3 rounded-xl bg-slate-100 border border-slate-200">
            {([
              { key: 'note', label: 'Note', icon: StickyNote },
              { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setComposer(t.key)}
                className={cn(
                  'flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all',
                  composer === t.key
                    ? t.key === 'whatsapp'
                      ? 'bg-white text-green-600 shadow-sm'
                      : 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {composer === 'note' ? (
            <div className="relative">
              <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !submitting && handleAddComment()}
                placeholder="Type a quick note…" className="input-field pr-12 py-3.5 text-sm" />
              <button onClick={handleAddComment} disabled={submitting || !newComment.trim()}
                aria-label="Add note"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl gradient-blue flex items-center justify-center text-white disabled:opacity-50 hover:scale-105 transition-all">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <WhatsAppComposer contact={selectedLead} onSent={logWhatsApp} />
          )}
        </div>
      </motion.div>

      {showMove && <MoveLeadModal lead={selectedLead} onClose={() => setShowMove(false)} onMoved={applyUpdated} />}
      {showSchedule && <ScheduleModal lead={selectedLead} onClose={() => setShowSchedule(false)} onScheduled={() => { fetchComments(); triggerRefresh(); }} />}
    </>
  );

  async function handleAddComment() {
    if (!newComment.trim() || !selectedLead) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ comment: Comment }>(`/api/leads/${selectedLead._id}/comments`, {
        method: 'POST',
        body: { comment: newComment, logCall: false },
      });
      setComments([res.comment, ...comments]);
      setNewComment('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSubmitting(false);
    }
  }
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">{icon}<span className="text-[9px] font-bold uppercase tracking-wider">{label}</span></div>
      <p className="text-xs font-semibold text-slate-800 truncate">{value}</p>
    </div>
  );
}
