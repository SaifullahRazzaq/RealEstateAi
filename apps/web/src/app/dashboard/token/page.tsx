'use client';

import { LeadList } from '@/components/dashboard/LeadList';
import { LeadDrawer } from '@/components/dashboard/LeadDrawer';
import { ImportExportBar } from '@/components/dashboard/ImportExportBar';
import { Handshake } from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';

export default function TokenPage() {
  const { setLeads } = useCRMStore();

  return (
    <div className="flex flex-col gap-4 lg:h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.2)' }}>
            <Handshake className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Token / Bayana</p>
            <p className="text-xs text-slate-500">Bayana taken, transfer pending</p>
          </div>
        </div>
        <ImportExportBar tab="token" onImported={() => setLeads([])} />
      </div>

      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(13,148,136,0.05)', border: '1px solid rgba(13,148,136,0.15)' }}>
        <Handshake className="w-4 h-4 text-teal-600 flex-shrink-0" />
        <p className="text-xs text-slate-600">
          These deals are held by bayana but nothing has transferred yet. They still count as open pipeline —
          a token can fall through, so the money is not booked until the deal is moved to Won.
        </p>
      </div>

      <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">
        <LeadList
          tab="token"
          emptyMessage="No deals on token right now"
          emptyIcon={<Handshake className="w-6 h-6 text-slate-600" />}
        />
      </div>

      <LeadDrawer />
    </div>
  );
}
