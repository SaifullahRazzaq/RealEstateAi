'use client';

import { LeadList } from '@/components/dashboard/LeadList';
import { LeadDrawer } from '@/components/dashboard/LeadDrawer';
import { TrendingUp, Star } from 'lucide-react';

export default function PipelinePage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <TrendingUp className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Pipeline — Hot Prospects</p>
          <p className="text-xs text-slate-500">High-potential leads tagged with <Star className="w-3 h-3 inline text-amber-400 fill-amber-400" /></p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
        <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
        <p className="text-xs text-slate-400">Pipeline leads remain in New Leads or Daily Task. Click the star icon in any lead to add it here.</p>
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
