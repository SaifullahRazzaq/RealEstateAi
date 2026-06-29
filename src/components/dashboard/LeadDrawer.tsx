'use client';

import { useEffect, useState, useRef } from 'react';
import {
  X, Phone, Star, Calendar, MessageSquare, Send, Loader2,
  XCircle, Trophy, CalendarPlus, Video, ChevronRight,
  MessageCircle, Mail, ExternalLink, Hash, Clock
} from 'lucide-react';
import { useCRMStore, Comment } from '@/store/crmStore';
import { formatDateTime, formatPhone, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New Lead', className: 'badge-new', color: '#3b82f6' },
  { value: 'daily', label: 'Daily Task', className: 'badge-daily', color: '#f59e0b' },
  { value: 'lost', label: 'Not Interested', className: 'badge-lost', color: '#ef4444' },
  { value: 'won', label: 'Deal Closed', className: 'badge-won', color: '#10b981' },
];

export function LeadDrawer() {
  const { selectedLead, setSelectedLead, drawerOpen, setDrawerOpen, comments, setComments, leads, setLeads } = useCRMStore();
  const [newComment, setNewComment] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedLead) {
      fetchComments();
      setFollowUpDate(selectedLead.followUpDate ? new Date(selectedLead.followUpDate).toISOString().split('T')[0] : '');
      setMeetingDate(selectedLead.meetingDate ? new Date(selectedLead.meetingDate).toISOString().split('T')[0] : '');
    }
  }, [selectedLead]);

  const fetchComments = async () => {
    if (!selectedLead) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${selectedLead._id}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLead = async (updates: Record<string, unknown>) => {
    if (!selectedLead) return;
    try {
      const res = await fetch(`/api/leads/${selectedLead._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setLeads(leads.map((l) => (l._id === selectedLead._id ? { ...l, ...data.lead } : l)));
      setSelectedLead({ ...selectedLead, ...data.lead });
      toast.success('Lead updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const sendWhatsApp = () => {
    if (!selectedLead) return;
    const msg = encodeURIComponent(`Hi ${selectedLead.name}, I'm calling from RealEstate CRM regarding your inquiry. When is a good time to talk?`);
    window.open(`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  const sendSMS = () => {
    if (!selectedLead) return;
    window.open(`sms:${selectedLead.phone}`, '_self');
  };

  if (!drawerOpen || !selectedLead) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-md"
        onClick={() => { setDrawerOpen(false); setSelectedLead(null); }}
      />

      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-[450px] z-50 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="px-6 py-6 border-b bg-slate-900/40" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl gradient-blue flex items-center justify-center text-white text-xl font-bold shadow-xl shadow-blue-500/20">
                {selectedLead.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">{selectedLead.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500 font-medium">{formatPhone(selectedLead.phone)}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">ID: {selectedLead._id.slice(-6)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => { setDrawerOpen(false); setSelectedLead(null); }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex gap-2">
            <button onClick={() => window.open(`tel:${selectedLead.phone}`, '_self')} className="flex-1 btn-primary py-2.5 rounded-xl gap-2 text-xs">
              <Phone className="w-3.5 h-3.5" /> Call Now
            </button>
            <button onClick={sendWhatsApp} className="flex-1 bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </button>
            <button onClick={sendSMS} className="w-12 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
              <Hash className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Status Selection */}
          <section>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-4">Pipeline Status</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleUpdateLead({ status: opt.value })}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold border transition-all duration-300',
                    selectedLead.status === opt.value
                      ? 'border-current shadow-lg'
                      : 'border-transparent opacity-40 hover:opacity-100 bg-white/5'
                  )}
                  style={{
                    color: opt.color,
                    background: selectedLead.status === opt.value ? `${opt.color}15` : undefined,
                    boxShadow: selectedLead.status === opt.value ? `0 10px 20px -10px ${opt.color}40` : undefined
                  }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Schedule Section */}
          <section className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Next Follow-up</p>
              <div className="relative group">
                <input 
                  type="date" 
                  value={followUpDate}
                  onChange={(e) => {
                    setFollowUpDate(e.target.value);
                    handleUpdateLead({ followUpDate: e.target.value, status: 'daily' });
                  }}
                  className="input-field py-3 text-xs w-full"
                  style={{ colorScheme: 'dark' }}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors pointer-events-none" />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Meeting Date</p>
              <div className="relative group">
                <input 
                  type="datetime-local" 
                  value={meetingDate}
                  onChange={(e) => {
                    setMeetingDate(e.target.value);
                    handleUpdateLead({ meetingDate: e.target.value });
                  }}
                  className="input-field py-3 text-xs w-full"
                  style={{ colorScheme: 'dark' }}
                />
                <Video className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors pointer-events-none" />
              </div>
            </div>
          </section>

          {/* Activity Logs */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Activity Timeline</p>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold">{comments.length} Log{comments.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-slate-700 animate-spin" /></div>
              ) : comments.map((comment, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={comment._id} 
                  className="relative pl-8"
                >
                  <div className="absolute left-0 top-1.5 w-[23px] h-[23px] rounded-full border-4 border-slate-900 bg-slate-800 flex items-center justify-center">
                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-blue-400">
                        {typeof comment.userId === 'object' ? comment.userId.name : 'System'}
                      </span>
                      <span className="text-[10px] text-slate-600">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">{comment.comment}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer: Quick Note */}
        <div className="p-6 bg-slate-900/40 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="relative">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !submitting && handleAddComment()}
              placeholder="Type a quick note..."
              className="input-field pr-12 py-4 text-sm"
            />
            <button
              onClick={handleAddComment}
              disabled={submitting || !newComment.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl gradient-blue flex items-center justify-center text-white disabled:opacity-50 transition-all hover:scale-105"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );

  async function handleAddComment() {
    if (!newComment.trim() || !selectedLead) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${selectedLead._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: newComment, logCall: false }),
      });
      const data = await res.json();
      setComments([data.comment, ...comments]);
      setNewComment('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSubmitting(false);
    }
  }
}
