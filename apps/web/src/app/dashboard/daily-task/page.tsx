'use client';

import { useEffect, useState } from 'react';
import { LeadList } from '@/components/dashboard/LeadList';
import { LeadDrawer } from '@/components/dashboard/LeadDrawer';
import { ImportExportBar } from '@/components/dashboard/ImportExportBar';
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function DailyTaskPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const { setLeads } = useCRMStore();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const isToday = selectedDate === getTodayStr();

  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <CalendarCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Daily Task</p>
            <p className="text-xs text-slate-500">Follow-ups scheduled for selected date</p>
          </div>
        </div>
        <ImportExportBar tab="daily" onImported={() => setLeads([])} />
      </div>

      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <button id="prev-day" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <CalendarCheck className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-slate-900">{formatDisplayDate(selectedDate)}</span>
          {isToday && <span className="badge badge-daily ml-1">Today</span>}
        </div>
        <button id="next-day" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <input
          id="date-picker"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input-field w-auto text-sm"
          style={{ colorScheme: 'light' }}
        />
        {!isToday && (
          <button id="go-today" onClick={() => setSelectedDate(getTodayStr())} className="btn-secondary text-xs py-2">
            Go to Today
          </button>
        )}
      </div>

      {/* Lead list */}
      <div className="flex-1 overflow-y-auto">
        <LeadList
          tab="daily"
          date={selectedDate}
          emptyMessage="No follow-ups for this date"
          emptyIcon={<CalendarCheck className="w-6 h-6 text-slate-600" />}
        />
      </div>

      <LeadDrawer />
    </div>
  );
}
