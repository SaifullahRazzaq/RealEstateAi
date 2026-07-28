'use client';

import { LeadList } from '@/components/dashboard/LeadList';
import { LeadDrawer } from '@/components/dashboard/LeadDrawer';
import { ImportExportBar } from '@/components/dashboard/ImportExportBar';
import { XCircle } from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';

export default function LostLeadsPage() {
  const { setLeads } = useCRMStore();

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Lost Leads</p>
            <p className="text-xs text-slate-500">Leads marked as not interested</p>
          </div>
        </div>
        <ImportExportBar tab="lost" onImported={() => setLeads([])} />
      </div>

      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <p className="text-xs text-slate-400">These leads have been marked as &ldquo;Not Interested&rdquo; and are excluded from other tabs.</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <LeadList
          tab="lost"
          emptyMessage="No lost leads"
          emptyIcon={<XCircle className="w-6 h-6 text-slate-600" />}
        />
      </div>

      <LeadDrawer />
    </div>
  );
}
