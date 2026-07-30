'use client';

import { LeadList } from '@/components/dashboard/LeadList';
import { LeadDrawer } from '@/components/dashboard/LeadDrawer';
import { ImportExportBar } from '@/components/dashboard/ImportExportBar';
import { PhoneCall } from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';

export default function InContactPage() {
  const { setLeads } = useCRMStore();

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <PhoneCall className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">In Contact</p>
            <p className="text-xs text-slate-500">Leads currently being engaged</p>
          </div>
        </div>
        <ImportExportBar tab="incontact" onImported={() => setLeads([])} />
      </div>

      <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">
        <LeadList
          tab="incontact"
          emptyMessage="No leads in contact yet"
          emptyIcon={<PhoneCall className="w-6 h-6 text-slate-600" />}
        />
      </div>

      <LeadDrawer />
    </div>
  );
}
