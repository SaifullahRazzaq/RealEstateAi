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
    <div className="flex flex-col gap-4 lg:h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      {/* Date navigator — arrows hug the date on a phone, the picker and the
          "today" escape hatch drop to their own row rather than overflowing. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <button id="prev-day" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            aria-label="Previous day"
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors flex-shrink-0"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl min-w-0" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <CalendarCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-slate-900 truncate">{formatDisplayDate(selectedDate)}</span>
            {isToday && <span className="badge badge-daily ml-1 flex-shrink-0">Today</span>}
          </div>
          <button id="next-day" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            aria-label="Next day"
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors flex-shrink-0"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <input
            id="date-picker"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field flex-1 sm:w-auto sm:flex-none text-sm"
            style={{ colorScheme: 'light' }}
          />
          {!isToday && (
            <button id="go-today" onClick={() => setSelectedDate(getTodayStr())} className="btn-secondary text-xs py-2 whitespace-nowrap flex-shrink-0">
              Go to Today
            </button>
          )}
        </div>
      </div>

      {/* Lead list */}
      <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">
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
