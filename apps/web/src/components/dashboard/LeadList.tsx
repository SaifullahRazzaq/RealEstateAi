'use client';

import { useEffect, useCallback, useState } from 'react';
import { Phone, Star, Calendar, ChevronRight, ChevronLeft, Loader2, MessageSquare, Clock } from 'lucide-react';
import { useCRMStore, Lead } from '@/store/crmStore';
import { formatDate, formatPhone, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface LeadListProps {
  tab: string;
  date?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
}

export function LeadList({ tab, date, emptyMessage = 'No leads found', emptyIcon }: LeadListProps) {
  const { leads, setLeads, setSelectedLead, searchQuery, selectedLead } = useCRMStore();
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const limit = 10;

  const fetchLeads = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        tab, 
        page: page.toString(),
        limit: limit.toString()
      });
      if (date) params.set('date', date);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLeads(data.leads);
      setTotalPages(data.pagination.pages);
      setTotalLeads(data.pagination.total);
    } catch {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [tab, date, searchQuery, setLeads]);

  useEffect(() => {
    setCurrentPage(1);
    const delayDebounceFn = setTimeout(() => {
      fetchLeads(1);
    }, searchQuery ? 500 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [tab, date, searchQuery, fetchLeads]);

  useEffect(() => {
    const interval = setInterval(() => fetchLeads(currentPage), 60000);
    return () => clearInterval(interval);
  }, [fetchLeads, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchLeads(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
    new: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' },
    daily: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
    lost: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
    won: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' },
  };

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!leads.length) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-32 text-center"
      >
        <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {emptyIcon || <span className="text-3xl">📋</span>}
        </div>
        <h3 className="text-white font-bold text-lg">{emptyMessage}</h3>
        <p className="text-slate-500 text-sm mt-2 max-w-xs">Leads will automatically appear here once they are added or assigned to you.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="grid grid-cols-1 gap-3">
        <AnimatePresence mode="popLayout">
          {leads.map((lead, idx) => {
            const style = statusStyles[lead.status] || statusStyles.new;
            return (
              <motion.div
                layout
                key={lead._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.03, duration: 0.4 }}
                onClick={() => setSelectedLead(lead)}
                className={cn(
                  'group flex items-center gap-5 px-6 py-5 rounded-[1.5rem] border cursor-pointer transition-all duration-500 relative overflow-hidden',
                  selectedLead?._id === lead._id
                    ? 'border-blue-500/40 shadow-2xl shadow-blue-500/5'
                    : 'hover:border-slate-700 hover:bg-white/[0.02]'
                )}
                style={{
                  background: selectedLead?._id === lead._id ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0) 100%)' : 'var(--bg-card)',
                  borderColor: selectedLead?._id === lead._id ? undefined : 'var(--border)',
                }}
              >
                {/* Glow Effect */}
                {selectedLead?._id === lead._id && (
                  <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />
                )}

                {/* Avatar */}
                <div className="w-12 h-12 rounded-2xl gradient-blue flex items-center justify-center text-white text-base font-bold flex-shrink-0 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-500">
                  {lead.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white truncate tracking-tight group-hover:text-blue-400 transition-colors">{lead.name}</span>
                    {lead.isPipeline && (
                      <div className="w-5 h-5 rounded-lg bg-amber-400/10 flex items-center justify-center">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500 font-medium">{formatPhone(lead.phone)}</span>
                    <div className="flex items-center gap-3">
                      {lead.followUpDate && (
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          <Clock className="w-3 h-3" />
                          {formatDate(lead.followUpDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status badge */}
                <div className={cn('px-3 py-1.5 rounded-xl flex items-center gap-2', style.bg)}>
                  <div className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
                  <span className={cn('text-[10px] font-bold uppercase tracking-widest', style.text)}>
                    {lead.status}
                  </span>
                </div>

                {/* Action Indicator */}
                <div className="w-10 h-10 rounded-xl bg-slate-900/50 flex items-center justify-center text-slate-500 group-hover:text-white group-hover:bg-blue-500 transition-all duration-500 border border-slate-800 group-hover:border-blue-400">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-6 bg-slate-900/30 rounded-3xl border border-slate-800/50 mt-10">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Showing <span className="text-white">{(currentPage - 1) * limit + 1}</span> to <span className="text-white">{Math.min(currentPage * limit, totalLeads)}</span> of <span className="text-white">{totalLeads}</span> leads
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="w-10 h-10 rounded-xl border border-slate-800 flex items-center justify-center hover:bg-white/5 disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <div className="flex items-center gap-1.5">
              {[...Array(totalPages)].map((_, i) => {
                const p = i + 1;
                if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                  return (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={cn(
                        'w-10 h-10 rounded-xl text-xs font-bold transition-all duration-300',
                        currentPage === p
                          ? 'gradient-blue text-white shadow-lg shadow-blue-500/20 scale-110'
                          : 'text-slate-500 hover:text-white hover:bg-white/10'
                      )}
                    >
                      {p}
                    </button>
                  );
                } else if (p === currentPage - 2 || p === currentPage + 2) {
                  return <span key={p} className="text-slate-700 font-bold px-1 text-xs">...</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              className="w-10 h-10 rounded-xl border border-slate-800 flex items-center justify-center hover:bg-white/5 disabled:opacity-20 transition-all"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
