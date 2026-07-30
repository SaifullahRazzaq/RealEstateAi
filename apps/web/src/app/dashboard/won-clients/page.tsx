'use client';

import { LeadList } from '@/components/dashboard/LeadList';
import { LeadDrawer } from '@/components/dashboard/LeadDrawer';
import { ImportExportBar } from '@/components/dashboard/ImportExportBar';
import { Trophy } from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';

export default function WonClientsPage() {
  const { setLeads } = useCRMStore();

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Trophy className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Won Clients</p>
            <p className="text-xs text-slate-500">Successfully closed deals</p>
          </div>
        </div>
        <ImportExportBar tab="won" onImported={() => setLeads([])} />
      </div>

      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
        <Trophy className="w-4 h-4 text-green-400 flex-shrink-0" />
        <p className="text-xs text-slate-400">Congratulations! These deals have been successfully closed. They appear exclusively in this tab.</p>
      </div>

      <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">
        <LeadList
          tab="won"
          emptyMessage="No won clients yet — keep pushing!"
          emptyIcon={<Trophy className="w-6 h-6 text-slate-600" />}
        />
      </div>

      <LeadDrawer />
    </div>
  );
}
