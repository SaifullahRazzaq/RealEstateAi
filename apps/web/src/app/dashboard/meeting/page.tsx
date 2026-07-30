'use client';

import { useEffect, useState } from 'react';
import { LeadList } from '@/components/dashboard/LeadList';
import { LeadDrawer } from '@/components/dashboard/LeadDrawer';
import { Loader2, Video } from 'lucide-react';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getWeekendDates() {
  const today = new Date();
  const day = today.getDay();
  const daysToSat = (6 - day + 7) % 7;
  const sat = new Date(today);
  sat.setDate(today.getDate() + daysToSat);
  return sat.toISOString().split('T')[0];
}

export default function MeetingPage() {
  // The clock is only read after mount: getTodayStr()/getWeekendDates() depend on
  // the local timezone, so rendering them on the server produces different markup
  // than the browser and breaks hydration.
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<'today' | 'weekend' | 'custom'>('today');
  const [customDate, setCustomDate] = useState('');

  useEffect(() => {
    setCustomDate(getTodayStr());
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const activeDate = filter === 'today' ? getTodayStr() : filter === 'weekend' ? getWeekendDates() : customDate;

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <Video className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Meetings</p>
            <p className="text-xs text-slate-500">Scheduled client meetings</p>
          </div>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex items-center flex-wrap gap-2">
        {(['today', 'weekend', 'custom'] as const).map((f) => (
          <button
            key={f}
            id={`meeting-filter-${f}`}
            onClick={() => setFilter(f)}
            className="px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold transition-all capitalize whitespace-nowrap"
            style={{
              background: filter === f ? 'rgba(6,182,212,0.15)' : 'var(--bg-card)',
              color: filter === f ? '#22d3ee' : '#64748b',
              border: filter === f ? '1px solid rgba(6,182,212,0.3)' : '1px solid var(--border)',
            }}
          >
            {f === 'weekend' ? 'This Weekend' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        {filter === 'custom' && (
          <input
            id="meeting-custom-date"
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="input-field w-auto text-xs"
            style={{ colorScheme: 'light' }}
          />
        )}
      </div>

      <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">
        <LeadList
          tab="meeting"
          date={activeDate}
          emptyMessage="No meetings scheduled for this date"
          emptyIcon={<Video className="w-6 h-6 text-slate-600" />}
        />
      </div>

      <LeadDrawer />
    </div>
  );
}
