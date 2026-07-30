'use client';

import { apiFetch } from '@/lib/api';
import { useEffect, useCallback, useRef, useState } from 'react';
import { Star, ChevronRight, ChevronLeft, Loader2, Clock, ArrowRightLeft, Banknote } from 'lucide-react';
import { useCRMStore, Lead, STATUS_META } from '@/store/crmStore';
import { formatDate, formatPhone, formatPKRCompact, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { MoveLeadModal } from './MoveLeadModal';
import { AIScoreBadge } from './AIScorePanel';
import { QuickContactActions } from './ContactActions';

interface LeadListProps {
  tab: string;
  date?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
}

/**
 * Rendered twice per row: inline with the lead's details on narrow screens, and
 * as its own column from `sm` up. Six columns don't fit in a phone's width, and
 * the pill is the one that reads fine under the name instead of beside it.
 */
function StatusPill({ meta, className }: { meta: { label: string; color: string }; className?: string }) {
  return (
    <div
      className={cn('px-3 py-1.5 rounded-xl items-center gap-2 flex-shrink-0', className)}
      style={{ background: `${meta.color}1a` }}
    >
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
      <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </div>
  );
}

export function LeadList({ tab, date, emptyMessage = 'No leads found', emptyIcon }: LeadListProps) {
  const { leads, setLeads, setSelectedLead, searchQuery, selectedLead, refreshKey } = useCRMStore();
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [moveLead, setMoveLead] = useState<Lead | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
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

      const data = await apiFetch<{ leads: Lead[]; pagination: { pages: number; total: number } }>(`/api/leads?${params}`);
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

  // Refresh when a lead is moved/updated elsewhere
  useEffect(() => {
    if (refreshKey > 0) fetchLeads(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchLeads(newPage);
      // The page scrolls inside `main` (and inside this list on desktop), so
      // window.scrollTo alone leaves the user parked on the pagination bar.
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
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
        <h3 className="text-slate-900 font-bold text-lg">{emptyMessage}</h3>
        <p className="text-slate-500 text-sm mt-2 max-w-xs">Leads will automatically appear here once they are added or assigned to you.</p>
      </motion.div>
    );
  }

  return (
    <div ref={topRef} className="space-y-6 pb-10 scroll-mt-4">
      <div className="grid grid-cols-1 gap-3">
        <AnimatePresence mode="popLayout">
          {leads.map((lead, idx) => {
            const meta = STATUS_META[lead.status] || STATUS_META.new;
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
                  'group flex items-center gap-3 sm:gap-5 px-4 sm:px-6 py-4 sm:py-5 rounded-[1.5rem] border cursor-pointer transition-all duration-500 relative overflow-hidden',
                  selectedLead?._id === lead._id
                    ? 'border-orange-500/40 shadow-2xl shadow-orange-500/5'
                    : 'hover:border-slate-200 hover:bg-slate-50'
                )}
                style={{
                  background: selectedLead?._id === lead._id ? 'linear-gradient(135deg, rgba(249, 98, 42, 0.08) 0%, rgba(249, 98, 42, 0) 100%)' : 'var(--bg-card)',
                  borderColor: selectedLead?._id === lead._id ? undefined : 'var(--border)',
                }}
              >
                {/* Glow Effect */}
                {selectedLead?._id === lead._id && (
                  <div className="absolute inset-0 bg-orange-500/5 animate-pulse" />
                )}

                {/* Avatar */}
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl gradient-blue flex items-center justify-center text-white text-base font-bold flex-shrink-0 shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform duration-500">
                  {lead.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900 truncate tracking-tight group-hover:text-orange-500 transition-colors">{lead.name}</span>
                    {lead.isPipeline && (
                      <div className="w-5 h-5 rounded-lg bg-amber-400/10 flex items-center justify-center">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      </div>
                    )}
                    <AIScoreBadge ai={lead.ai} />
                  </div>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 sm:gap-x-4">
                    <span className="text-xs text-slate-500 font-medium">{formatPhone(lead.phone)}</span>
                    {lead.company && <span className="text-[11px] text-slate-600 truncate hidden sm:inline">{lead.company}</span>}
                    {lead.followUpDate && (
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        {formatDate(lead.followUpDate)}
                      </span>
                    )}
                    <StatusPill meta={meta} className="flex sm:hidden" />
                  </div>
                </div>

                {/* Deal value — compact, so a crore-scale figure still fits the row */}
                {lead.dealValue > 0 && (
                  <div className="hidden md:flex items-center gap-1 text-xs font-bold text-green-600 whitespace-nowrap">
                    <Banknote className="w-3.5 h-3.5 flex-shrink-0" />
                    {formatPKRCompact(lead.dealValue)}
                  </div>
                )}

                {/* Status badge */}
                <StatusPill meta={meta} className="hidden sm:flex" />

                {/* Call / WhatsApp — the two actions worth reaching without
                    opening the lead first, which is most of phone use. */}
                <QuickContactActions contact={lead} />

                {/* Move button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setMoveLead(lead); }}
                  title="Move lead"
                  className="hidden sm:flex w-10 h-10 rounded-xl bg-slate-50 items-center justify-center text-slate-500 hover:text-white hover:bg-orange-500 transition-all border border-slate-200 hover:border-orange-400 flex-shrink-0"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>

                {/* Action Indicator */}
                <div className="hidden md:flex w-10 h-10 rounded-xl bg-slate-50 items-center justify-center text-slate-500 group-hover:text-white group-hover:bg-orange-500 transition-all duration-500 border border-slate-200 group-hover:border-orange-400 flex-shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-5 sm:py-6 bg-slate-50 rounded-3xl border border-slate-200 mt-8 sm:mt-10">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center sm:text-left">
            Showing <span className="text-slate-900">{(currentPage - 1) * limit + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * limit, totalLeads)}</span> of <span className="text-slate-900">{totalLeads}</span> leads
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              aria-label="Previous page"
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100 disabled:opacity-20 transition-all flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4 text-slate-900" />
            </button>
            {/* One page either side on a phone, two on a desktop — five 40px
                buttons plus arrows is already wider than a 360px screen. */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {[...Array(totalPages)].map((_, i) => {
                const p = i + 1;
                const distance = Math.abs(p - currentPage);
                if (p === 1 || p === totalPages || distance <= 1) {
                  return (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={cn(
                        'w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-xs font-bold transition-all duration-300 flex-shrink-0',
                        distance > 1 && 'hidden sm:block',
                        currentPage === p
                          ? 'gradient-blue text-white shadow-lg shadow-orange-500/20'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      )}
                    >
                      {p}
                    </button>
                  );
                }
                if (distance === 2) {
                  return <span key={p} className="hidden sm:block text-slate-400 font-bold px-1 text-xs">…</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              aria-label="Next page"
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100 disabled:opacity-20 transition-all flex-shrink-0"
            >
              <ChevronRight className="w-4 h-4 text-slate-900" />
            </button>
          </div>
        </div>
      )}

      {moveLead && (
        <MoveLeadModal
          lead={moveLead}
          onClose={() => setMoveLead(null)}
          onMoved={(updated) => {
            // Drop the lead from this list if it no longer matches the tab's status
            setLeads(leads.filter((l) => l._id !== updated._id));
            setTotalLeads((t) => Math.max(0, t - 1));
          }}
        />
      )}
    </div>
  );
}
