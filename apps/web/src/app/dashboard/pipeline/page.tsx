'use client';

import { LeadList } from '@/components/dashboard/LeadList';
import { LeadDrawer } from '@/components/dashboard/LeadDrawer';
import { TrendingUp, ArrowRightLeft } from 'lucide-react';

export default function PipelinePage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <TrendingUp className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Pipeline</p>
          <p className="text-xs text-slate-500">Live prospects with no date set against them</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
        <ArrowRightLeft className="w-4 h-4 text-purple-400 flex-shrink-0" />
        <p className="text-xs text-slate-600">
          A live prospect parked here has nothing booked yet. Use Move Lead to give it a task date
          or a meeting the moment there is one.
        </p>
      </div>

      <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">
        <LeadList
          tab="pipeline"
          emptyMessage="No pipeline leads yet"
          emptyIcon={<TrendingUp className="w-6 h-6 text-slate-600" />}
        />
      </div>

      <LeadDrawer />
    </div>
  );
}
