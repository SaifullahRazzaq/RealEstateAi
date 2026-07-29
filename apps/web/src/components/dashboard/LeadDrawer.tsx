'use client';

import { apiFetch } from '@/lib/api';
import { useEffect, useState, useRef } from 'react';
import {
  X, Phone, Send, Loader2, Video, MessageCircle, Hash, Clock,
  ArrowRightLeft, CalendarPlus, DollarSign, Mail, Building2, Star,
} from 'lucide-react';
import { useCRMStore, Comment, Lead, STATUS_META } from '@/store/crmStore';
import { formatDateTime, formatPhone, cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { MoveLeadModal } from './MoveLeadModal';
import { ScheduleModal } from './ScheduleModal';
import { AIScorePanel, useAIEnabled } from './AIScorePanel';

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

  const sendWhatsApp = () => {
    if (!selectedLead) return;
    const msg = encodeURIComponent(`Hi ${selectedLead.name}, following up on your inquiry. When is a good time to talk?`);
    window.open(`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  if (!drawerOpen || !selectedLead) return null;
  const meta = STATUS_META[selectedLead.status];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-40 backdrop-blur-md"
        onClick={() => { setDrawerOpen(false); setSelectedLead(null); }} />

      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-[460px] max-w-full z-50 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="px-6 py-6 border-b bg-slate-50" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl gradient-blue flex items-center justify-center text-white text-xl font-bold shadow-xl shadow-orange-500/20">
                {selectedLead.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">{selectedLead.name}</h2>
                  {selectedLead.isPipeline && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('badge', meta.badge)}>{meta.label}</span>
                  {selectedLead.company && <span className="text-[11px] text-slate-500">{selectedLead.company}</span>}
                </div>
              </div>
            </div>
            <button onClick={() => { setDrawerOpen(false); setSelectedLead(null); }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100">
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
              style={{ background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.25)' }}>
              <CalendarPlus className="w-3.5 h-3.5" /> Schedule
            </button>
          </div>

          {/* Contact actions */}
          <div className="flex gap-2">
            <button onClick={() => window.open(`tel:${selectedLead.phone}`, '_self')}
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-300 hover:text-slate-900 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all">
              <Phone className="w-3.5 h-3.5" /> Call
            </button>
            <button onClick={sendWhatsApp}
              className="flex-1 bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </button>
            <button onClick={() => window.open(`sms:${selectedLead.phone}`, '_self')}
              className="w-11 bg-slate-100 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all">
              <Hash className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-7 custom-scrollbar">
          {/* Contact details */}
          <section className="grid grid-cols-2 gap-3">
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

          {/* Deal value */}
          <section>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-3">Deal Value ($)</p>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              <input type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)}
                onBlur={() => { if (Number(dealValue) !== selectedLead.dealValue) patchLead({ dealValue: Number(dealValue) || 0 }); }}
                placeholder="0" className="input-field pl-10" />
            </div>
            {selectedLead.status === 'won' && selectedLead.wonValue > 0 && (
              <p className="text-[11px] text-green-400 font-bold mt-2">✓ Collected ${selectedLead.wonValue.toLocaleString()}</p>
            )}
          </section>

          {/* Pipeline toggle + meeting date */}
          <section className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <Star className={cn('w-4 h-4', selectedLead.isPipeline ? 'text-amber-400 fill-amber-400' : 'text-slate-600')} />
              <span className="text-xs font-semibold text-slate-300">Mark as Pipeline (hot)</span>
            </div>
            <button onClick={() => patchLead({ isPipeline: !selectedLead.isPipeline })}
              className={cn('w-11 h-6 rounded-full transition-all relative', selectedLead.isPipeline ? 'bg-amber-500' : 'bg-slate-700')}>
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
                      <span className="text-[10px] text-slate-600">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{comment.comment}</p>
                  </div>
                </motion.div>
              ))}
              <div ref={commentsEndRef} />
            </div>
          </section>
        </div>

        {/* Quick note */}
        <div className="p-6 bg-slate-50 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="relative">
            <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !submitting && handleAddComment()}
              placeholder="Type a quick note…" className="input-field pr-12 py-4 text-sm" />
            <button onClick={handleAddComment} disabled={submitting || !newComment.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl gradient-blue flex items-center justify-center text-white disabled:opacity-50 hover:scale-105 transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
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
    <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">{icon}<span className="text-[9px] font-bold uppercase tracking-wider">{label}</span></div>
      <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
    </div>
  );
}
