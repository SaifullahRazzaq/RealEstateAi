'use client';

import { LeadList } from '@/components/dashboard/LeadList';
import { LeadDrawer } from '@/components/dashboard/LeadDrawer';
import { ImportExportBar } from '@/components/dashboard/ImportExportBar';
import { Users } from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';

export default function NewLeadsPage() {
  const { setLeads } = useCRMStore();

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">New Leads</p>
            <p className="text-xs text-slate-500">Fresh incoming contacts</p>
          </div>
        </div>
        <ImportExportBar tab="new" onImported={() => setLeads([])} />
      </div>

      {/* Lead list */}
      <div className="flex-1 overflow-y-auto">
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
