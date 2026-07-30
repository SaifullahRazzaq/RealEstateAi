'use client';

import { apiFetch } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, Loader2, Search, MapPin, Users, Maximize2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Property, PropertyStatus, PROPERTY_STATUS_META, PROPERTY_TYPES, MatchReason, Lead,
} from '@/store/crmStore';
import { formatArea, formatPKR, formatPKRCompact, cn } from '@/lib/utils';
import { PropertyModal } from '@/components/dashboard/PropertyModal';

interface Stats {
  total: number; available: number; onToken: number; sold: number; availableValue: number;
}

interface LeadMatch { lead: Lead; score: number; reasons: MatchReason[] }

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PropertyStatus | 'all'>('all');
  const [type, setType] = useState<string>('all');
  const [editing, setEditing] = useState<Property | null>(null);
  const [adding, setAdding] = useState(false);
  // Which listing's interested-clients panel is open.
  const [matchesFor, setMatchesFor] = useState<Property | null>(null);
  const [matches, setMatches] = useState<LeadMatch[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);

      const [list, s] = await Promise.all([
        apiFetch<{ properties: Property[] }>(`/api/properties?${params}`),
        apiFetch<Stats>('/api/properties/stats'),
      ]);
      setProperties(list.properties);
      setStats(s);
    } catch {
      toast.error('Could not load listings');
    } finally {
      setLoading(false);
    }
  }, [search, status, type]);

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  /** "Who wants this?" — usually already answered by the existing pipeline. */
  const openMatches = async (property: Property) => {
    setMatchesFor(property);
    setMatches(null);
    try {
      const res = await apiFetch<{ matches: LeadMatch[] }>(`/api/properties/${property._id}/matches`);
      setMatches(res.matches);
    } catch {
      toast.error('Could not load matching clients');
      setMatchesFor(null);
    }
  };

  const tiles = [
    { label: 'Listings', value: stats?.total ?? '—' },
    { label: 'Available', value: stats?.available ?? '—' },
    { label: 'On token', value: stats?.onToken ?? '—' },
    { label: 'Stock value', value: stats ? formatPKRCompact(stats.availableValue) : '—' },
  ];

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,98,42,0.1)', border: '1px solid rgba(249,98,42,0.2)' }}>
            <Building2 className="w-4 h-4 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Properties</p>
            <p className="text-xs text-slate-500">Stock the whole team can match clients against</p>
          </div>
        </div>
        <button onClick={() => setAdding(true)} className="btn-primary py-3 sm:py-2.5 px-4 justify-center w-full sm:w-auto flex-shrink-0">
          <Plus className="w-4 h-4" /> Add listing
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <p className="text-xl font-bold text-slate-900 truncate">{t.value}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search society, block, plot no or ref…" className="input-field pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as PropertyStatus | 'all')} className="input-field sm:w-40">
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="token">On token</option>
          <option value="sold">Sold</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="input-field sm:w-36 capitalize">
          <option value="all">All types</option>
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading && properties.length === 0 ? (
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="font-bold text-slate-900">No listings yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">Add your stock here and every client enquiry can be matched against it.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {properties.map((p, i) => {
            const meta = PROPERTY_STATUS_META[p.status];
            return (
              <motion.div key={p._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.title}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {[p.society, p.block, p.city].filter(Boolean).join(' · ') || 'Location not set'}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                    style={{ background: `${meta.color}1a`, color: meta.color }}>
                    {meta.label}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-bold text-slate-900">{formatPKR(p.price)}</span>
                  <span className="text-[11px] text-slate-500">{p.ratePerMarla > 0 ? `${formatPKRCompact(p.ratePerMarla)}/marla` : ''}</span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3" />{formatArea(p.areaSqft)}</span>
                  <span className="capitalize">{p.type}</span>
                  {p.corner && <span className="text-orange-600 font-semibold">Corner</span>}
                  {p.parkFacing && <span className="text-green-600 font-semibold">Park facing</span>}
                </div>

                <div className="flex gap-2 mt-auto pt-1">
                  <button onClick={() => openMatches(p)} className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Who wants this
                  </button>
                  <button onClick={() => setEditing(p)} className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100">
                    Edit
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {(adding || editing) && (
        <PropertyModal
          property={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => load()}
        />
      )}

      {matchesFor && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMatchesFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl bg-white border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200">
              <p className="text-sm font-bold text-slate-900">Clients looking for this</p>
              <p className="text-[11px] text-slate-500 truncate">{matchesFor.title}</p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-200">
              {matches === null ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-orange-500 animate-spin" /></div>
              ) : matches.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-slate-500">
                  No open lead matches this yet. Record what your clients are looking for and they will show up here.
                </p>
              ) : matches.map((m) => (
                <div key={m.lead._id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900 truncate">{m.lead.name}</p>
                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                      m.score >= 80 ? 'bg-green-500/10 text-green-700' : m.score >= 60 ? 'bg-amber-500/10 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                      {m.score}% match
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {m.reasons.map((r) => (
                      <span key={r.label} className={cn('text-[10px] px-2 py-0.5 rounded-full',
                        r.fits ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-800 border border-amber-200')}>
                        {r.fits ? '✓' : '!'} {r.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-200">
              <button onClick={() => setMatchesFor(null)} className="btn-secondary w-full justify-center">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
