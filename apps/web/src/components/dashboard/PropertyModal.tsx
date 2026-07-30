'use client';

import { apiFetch } from '@/lib/api';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Property, PropertyType, PROPERTY_TYPES } from '@/store/crmStore';
import { AREA_UNITS, AreaUnit, formatPKR, formatPKRCompact, toSqft } from '@/lib/utils';

interface Props {
  /** Absent when adding. */
  property?: Property | null;
  onClose: () => void;
  onSaved: (property: Property) => void;
}

const FEATURES = [
  { key: 'corner', label: 'Corner' },
  { key: 'parkFacing', label: 'Park facing' },
  { key: 'boulevard', label: 'Boulevard' },
  { key: 'possessionReady', label: 'Possession ready' },
] as const;

export function PropertyModal({ property, onClose, onSaved }: Props) {
  const editing = Boolean(property?._id);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: property?.title ?? '',
    code: property?.code ?? '',
    type: (property?.type ?? 'plot') as PropertyType,
    purpose: property?.purpose ?? 'sale',
    status: property?.status ?? 'available',
    city: property?.city ?? '',
    society: property?.society ?? '',
    block: property?.block ?? '',
    plotNo: property?.plotNo ?? '',
    size: String(property?.size ?? ''),
    sizeUnit: (property?.sizeUnit ?? 'marla') as AreaUnit,
    price: String(property?.price ?? ''),
    bedrooms: String(property?.bedrooms ?? ''),
    bathrooms: String(property?.bathrooms ?? ''),
    corner: property?.corner ?? false,
    parkFacing: property?.parkFacing ?? false,
    boulevard: property?.boulevard ?? false,
    possessionReady: property?.possessionReady ?? false,
    ownerName: property?.ownerName ?? '',
    ownerPhone: property?.ownerPhone ?? '',
    notes: property?.notes ?? '',
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // The rate is what plots get compared on, so it is shown while typing
  // rather than only after saving.
  const sqft = toSqft(Number(form.size) || 0, form.sizeUnit);
  const rate = sqft > 0 ? Math.round((Number(form.price) || 0) / (sqft / 225)) : 0;

  const save = async () => {
    if (!form.title.trim()) {
      toast.error('Give the listing a title');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        size: Number(form.size) || 0,
        price: Number(form.price) || 0,
        bedrooms: form.bedrooms === '' ? undefined : Number(form.bedrooms),
        bathrooms: form.bathrooms === '' ? undefined : Number(form.bathrooms),
      };
      const res = editing
        ? await apiFetch<{ property: Property }>(`/api/properties/${property!._id}`, { method: 'PATCH', body })
        : await apiFetch<{ property: Property }>('/api/properties', { method: 'POST', body });

      toast.success(editing ? 'Listing updated' : 'Listing added');
      onSaved(res.property);
      onClose();
    } catch {
      toast.error(editing ? 'Could not update the listing' : 'Could not add the listing');
    } finally {
      setSaving(false);
    }
  };

  const label = 'text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-1.5 block';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }} onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>

          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl gradient-blue flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">{editing ? 'Edit listing' : 'Add listing'}</h3>
                <p className="text-[11px] text-slate-500 truncate">Stock the whole team can match clients against</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-5">
            <div>
              <label className={label}>Title</label>
              <input value={form.title} onChange={(e) => set({ title: e.target.value })}
                placeholder="10 marla corner plot, DHA Phase 6" className="input-field" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={label}>Type</label>
                <select value={form.type} onChange={(e) => set({ type: e.target.value as PropertyType })} className="input-field capitalize">
                  {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Purpose</label>
                <select value={form.purpose} onChange={(e) => set({ purpose: e.target.value as 'sale' | 'rent' })} className="input-field">
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                </select>
              </div>
              <div>
                <label className={label}>Status</label>
                <select value={form.status} onChange={(e) => set({ status: e.target.value as Property['status'] })} className="input-field">
                  <option value="available">Available</option>
                  <option value="token">On token</option>
                  <option value="sold">Sold</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
              <div>
                <label className={label}>Ref code</label>
                <input value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder="DHA6-1042" className="input-field" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={label}>Society</label>
                <input value={form.society} onChange={(e) => set({ society: e.target.value })} placeholder="DHA Phase 6" className="input-field" />
              </div>
              <div>
                <label className={label}>Block / sector</label>
                <input value={form.block} onChange={(e) => set({ block: e.target.value })} placeholder="Block K" className="input-field" />
              </div>
              <div>
                <label className={label}>Plot no</label>
                <input value={form.plotNo} onChange={(e) => set({ plotNo: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className={label}>City</label>
                <input value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="Lahore" className="input-field" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={label}>Size</label>
                <input type="number" step="0.5" value={form.size} onChange={(e) => set({ size: e.target.value })} placeholder="10" className="input-field" />
              </div>
              <div>
                <label className={label}>Unit</label>
                <select value={form.sizeUnit} onChange={(e) => set({ sizeUnit: e.target.value as AreaUnit })} className="input-field">
                  {AREA_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={label}>Demand price (PKR)</label>
                <input type="number" value={form.price} onChange={(e) => set({ price: e.target.value })} placeholder="25000000" className="input-field" />
              </div>
            </div>

            {(sqft > 0 || Number(form.price) > 0) && (
              <p className="text-[11px] text-slate-600 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                {formatPKR(Number(form.price) || 0)}
                {rate > 0 && <> · <b>{formatPKRCompact(rate)}/marla</b></>}
                {sqft > 0 && <span className="text-slate-500"> · {sqft.toLocaleString('en-PK')} sq ft</span>}
              </p>
            )}

            {(form.type === 'house' || form.type === 'flat') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Bedrooms</label>
                  <input type="number" value={form.bedrooms} onChange={(e) => set({ bedrooms: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className={label}>Bathrooms</label>
                  <input type="number" value={form.bathrooms} onChange={(e) => set({ bathrooms: e.target.value })} className="input-field" />
                </div>
              </div>
            )}

            <div>
              <label className={label}>Features</label>
              <div className="flex flex-wrap gap-2">
                {FEATURES.map((f) => {
                  const on = form[f.key];
                  return (
                    <button key={f.key} type="button" onClick={() => set({ [f.key]: !on } as Partial<typeof form>)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        on ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Owner name</label>
                <input value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className={label}>Owner phone</label>
                <input value={form.ownerPhone} onChange={(e) => set({ ownerPhone: e.target.value })} placeholder="0300 1234567" className="input-field" />
              </div>
            </div>

            <div>
              <label className={label}>Notes</label>
              <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className="input-field resize-none" />
            </div>
          </div>

          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editing ? 'Save changes' : 'Add listing'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
