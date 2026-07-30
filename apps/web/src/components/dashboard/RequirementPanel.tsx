'use client';

import { apiFetch } from '@/lib/api';
import { useState } from 'react';
import { Loader2, Search, Check, Pencil, MapPin, Maximize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Lead, Property, PropertyType, PROPERTY_TYPES, MatchReason,
} from '@/store/crmStore';
import { AREA_UNITS, AreaUnit, formatArea, formatPKR, formatPKRCompact, fromSqft, cn } from '@/lib/utils';

interface Match { property: Property; score: number; reasons: MatchReason[] }

/**
 * The client's requirement, and the stock that fits it.
 *
 * These live together on purpose: the requirement is only worth collecting
 * because it produces the list underneath it, and an agent who sees an empty
 * match list immediately knows which field to go fill in.
 */
export function RequirementPanel({ lead, onUpdated }: { lead: Lead; onUpdated: (lead: Lead) => void }) {
  const req = lead.requirement;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [form, setForm] = useState({
    types: req?.types ?? [],
    minBudget: String(req?.minBudget || ''),
    maxBudget: String(req?.maxBudget || ''),
    locations: (req?.locations ?? []).join(', '),
    areaUnit: (req?.areaUnit ?? 'marla') as AreaUnit,
    minArea: req?.minAreaSqft ? String(fromSqft(req.minAreaSqft, req.areaUnit ?? 'marla')) : '',
    maxArea: req?.maxAreaSqft ? String(fromSqft(req.maxAreaSqft, req.areaUnit ?? 'marla')) : '',
    intent: req?.intent ?? '',
  });

  const hasRequirement =
    (req?.types?.length ?? 0) > 0 || (req?.locations?.length ?? 0) > 0 || (req?.maxBudget ?? 0) > 0;

  const toggleType = (t: PropertyType) =>
    setForm((f) => ({ ...f, types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t] }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<{ lead: Lead }>(`/api/properties/requirement/${lead._id}`, {
        method: 'PATCH',
        body: {
          types: form.types,
          minBudget: Number(form.minBudget) || 0,
          maxBudget: Number(form.maxBudget) || 0,
          locations: form.locations.split(',').map((s) => s.trim()).filter(Boolean),
          areaUnit: form.areaUnit,
          minArea: Number(form.minArea) || 0,
          maxArea: Number(form.maxArea) || 0,
          intent: form.intent || undefined,
        },
      });
      toast.success('Requirement saved');
      onUpdated(res.lead);
      setEditing(false);
      setMatches(null); // stale the moment the requirement changes
    } catch {
      toast.error('Could not save the requirement');
    } finally {
      setSaving(false);
    }
  };

  const findMatches = async () => {
    setSearching(true);
    try {
      const res = await apiFetch<{ matches: Match[] }>(`/api/properties/match/lead/${lead._id}`);
      setMatches(res.matches);
      if (!res.matches.length) toast('Nothing in stock fits this yet', { icon: '🔍' });
    } catch {
      toast.error('Could not search the stock');
    } finally {
      setSearching(false);
    }
  };

  const label = 'text-[9px] font-bold text-slate-500 uppercase tracking-wider';

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Requirement</p>
        <button onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-500 hover:text-orange-600">
          <Pencil className="w-3 h-3" /> {editing ? 'Cancel' : hasRequirement ? 'Edit' : 'Add'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div>
            <span className={label}>Property type</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {PROPERTY_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => toggleType(t)}
                  className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold border capitalize transition-all',
                    form.types.includes(t) ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' : 'bg-white text-slate-600 border-slate-200')}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>Budget from</span>
              <input type="number" value={form.minBudget} onChange={(e) => setForm({ ...form, minBudget: e.target.value })} className="input-field mt-1" />
            </label>
            <label className="block">
              <span className={label}>Budget to</span>
              <input type="number" value={form.maxBudget} onChange={(e) => setForm({ ...form, maxBudget: e.target.value })} placeholder="25000000" className="input-field mt-1" />
            </label>
          </div>

          <label className="block">
            <span className={label}>Locations (comma separated)</span>
            <input value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })}
              placeholder="DHA Phase 6, Bahria Town" className="input-field mt-1" />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className={label}>Size from</span>
              <input type="number" step="0.5" value={form.minArea} onChange={(e) => setForm({ ...form, minArea: e.target.value })} className="input-field mt-1" />
            </label>
            <label className="block">
              <span className={label}>Size to</span>
              <input type="number" step="0.5" value={form.maxArea} onChange={(e) => setForm({ ...form, maxArea: e.target.value })} className="input-field mt-1" />
            </label>
            <label className="block">
              <span className={label}>Unit</span>
              <select value={form.areaUnit} onChange={(e) => setForm({ ...form, areaUnit: e.target.value as AreaUnit })} className="input-field mt-1">
                {AREA_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className={label}>Buying for</span>
            <select value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value as '' | 'investment' | 'end-use' })} className="input-field mt-1">
              <option value="">Not stated</option>
              <option value="investment">Investment</option>
              <option value="end-use">End use</option>
            </select>
          </label>

          <button onClick={save} disabled={saving} className="btn-primary w-full justify-center py-2.5 disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save requirement
          </button>
        </div>
      ) : !hasRequirement ? (
        <p className="text-xs text-slate-500 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200">
          Nothing recorded yet. Add what this client is looking for and the CRM can match them against your stock.
        </p>
      ) : (
        <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
          {req.maxBudget > 0 && (
            <p className="text-xs text-slate-800">
              <span className="text-slate-500">Budget </span>
              {req.minBudget > 0 ? `${formatPKRCompact(req.minBudget)} – ` : 'up to '}{formatPKRCompact(req.maxBudget)}
            </p>
          )}
          {req.locations?.length > 0 && (
            <p className="text-xs text-slate-800 flex items-start gap-1.5">
              <MapPin className="w-3 h-3 mt-0.5 text-slate-500 flex-shrink-0" />{req.locations.join(', ')}
            </p>
          )}
          {(req.minAreaSqft > 0 || req.maxAreaSqft > 0) && (
            <p className="text-xs text-slate-800 flex items-center gap-1.5">
              <Maximize2 className="w-3 h-3 text-slate-500" />
              {req.minAreaSqft > 0 && req.maxAreaSqft > 0 && req.minAreaSqft !== req.maxAreaSqft
                ? `${formatArea(req.minAreaSqft)} – ${formatArea(req.maxAreaSqft)}`
                : formatArea(req.maxAreaSqft || req.minAreaSqft)}
            </p>
          )}
          {req.types?.length > 0 && <p className="text-xs text-slate-600 capitalize">{req.types.join(', ')}</p>}
          {req.intent && <p className="text-[11px] text-slate-500 capitalize">For {req.intent}</p>}
        </div>
      )}

      {hasRequirement && !editing && (
        <>
          <button onClick={findMatches} disabled={searching}
            className="w-full mt-3 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold bg-orange-500/10 text-orange-600 border border-orange-500/25 hover:bg-orange-500/15 disabled:opacity-50">
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {matches ? 'Search stock again' : 'Find matching properties'}
          </button>

          {matches && matches.length > 0 && (
            <div className="mt-3 space-y-2">
              {matches.map((m) => (
                <div key={m.property._id} className="px-3 py-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{m.property.title}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {[m.property.society, m.property.block].filter(Boolean).join(' · ')} · {formatArea(m.property.areaSqft)}
                      </p>
                    </div>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                      m.score >= 80 ? 'bg-green-500/10 text-green-700' : m.score >= 60 ? 'bg-amber-500/10 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                      {m.score}%
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 mt-1">{formatPKR(m.property.price)}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {m.reasons.map((r) => (
                      <span key={r.label} className={cn('text-[9px] px-1.5 py-0.5 rounded-full',
                        r.fits ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800')}>
                        {r.fits ? '✓' : '!'} {r.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {matches && matches.length === 0 && (
            <p className="text-[11px] text-slate-500 mt-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
              Nothing in stock fits this yet. Widen the budget or area, or add the listing when it comes in.
            </p>
          )}
        </>
      )}
    </section>
  );
}
