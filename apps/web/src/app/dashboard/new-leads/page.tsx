'use client';

import { LeadList } from '@/components/dashboard/LeadList';
import { LeadDrawer } from '@/components/dashboard/LeadDrawer';
import { ImportExportBar } from '@/components/dashboard/ImportExportBar';
import { Users } from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';

export default function NewLeadsPage() {
  const { setLeads } = useCRMStore();

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(249,98,42,0.1)', border: '1px solid rgba(249,98,42,0.2)' }}>
            <Users className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">New Leads</p>
            <p className="text-xs text-slate-500">Fresh incoming contacts</p>
          </div>
        </div>
        <ImportExportBar tab="new" onImported={() => setLeads([])} />
      </div>

      {/* Lead list */}
      <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">
        <LeadList
          tab="new"
          emptyMessage="No new leads yet"
          emptyIcon={<Users className="w-6 h-6 text-slate-600" />}
        />
      </div>

      <LeadDrawer />
    </div>
  );
}
