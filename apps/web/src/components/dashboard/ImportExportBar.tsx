'use client';

import { apiFetch, apiFetchBlob, ApiRequestError } from '@/lib/api';
import { useRef, useState } from 'react';
import { Upload, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCRMStore } from '@/store/crmStore';
import { useAIEnabled } from './AIScorePanel';
import { BulkScoreButton } from './BulkScoreButton';

interface ImportExportBarProps {
  tab: string;
  onImported?: () => void;
}

export function ImportExportBar({ tab, onImported }: ImportExportBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const aiEnabled = useAIEnabled();

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const data = await apiFetch<{ imported: number; skipped: number }>('/api/leads/import', {
        method: 'POST',
        body: formData,
      });
      toast.success(`✅ Imported ${data.imported} leads!`);
      onImported?.();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await apiFetchBlob(`/api/leads/export?tab=${tab}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${tab}-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export complete');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Lives here so every list page gets it without repeating the wiring. */}
      <BulkScoreButton enabled={aiEnabled} />
      <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleImport} className="hidden" id="import-file-input" />
      <button
        id="import-btn"
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="btn-secondary text-xs py-2 px-3"
      >
        {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        Import Excel
      </button>
      <button
        id="export-btn"
        onClick={handleExport}
        disabled={exporting}
        className="btn-secondary text-xs py-2 px-3"
      >
        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Export
      </button>
    </div>
  );
}
