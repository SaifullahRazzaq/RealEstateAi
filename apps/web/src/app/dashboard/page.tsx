'use client';

import { apiFetch } from '@/lib/api';
import { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, Trophy, XCircle, CalendarClock, Target, Users,
  Wallet, Loader2, ArrowUpRight, ArrowDownRight, Phone, PieChart as PieIcon, BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_META } from '@/store/crmStore';

interface DashboardData {
  range: { start: string; end: string };
  kpis: {
    totalLeads: number; newLeads: number; inContact: number; followedUp: number;
    due: number; meeting: number; wonCount: number; lostCount: number;
    createdInRange: number; meetingsScheduled: number; calls: number;
    revenueWon: number; pipelineValue: number; avgDealValue: number; conversionRate: number;
  };
  timeseries: { date: string; created: number; won: number; lost: number; revenue: number }[];
  statusDistribution: { name: string; value: number }[];
  sourceDistribution: { name: string; value: number }[];
  topDeals: any[];
  recentWon: any[];
  upcomingMeetings: any[];
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${(n || 0).toLocaleString()}`;
}
function fmtFullMoney(n: number) {
  return `$${(n || 0).toLocaleString()}`;
}

const PRESETS: { label: string; days: number }[] = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState(30);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => setMounted(true), []);

  const applyPreset = (days: number) => {
    setPreset(days);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiFetch<DashboardData>(`/api/dashboard?start=${startDate}&end=${endDate}`);
      setData(json);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (mounted) fetchData();
  }, [mounted, fetchData]);

  if (!mounted) return null;

  const k = data?.kpis;

  const kpiCards = [
    { label: 'Revenue Won', value: k ? fmtMoney(k.revenueWon) : '—', sub: k ? fmtFullMoney(k.revenueWon) : '', icon: DollarSign, grad: 'gradient-green', accent: '#10b981', trend: 'in' },
    { label: 'Pipeline Value', value: k ? fmtMoney(k.pipelineValue) : '—', sub: 'expected incoming', icon: Wallet, grad: 'gradient-blue', accent: '#f9622a', trend: 'in' },
    { label: 'Deals Won', value: k?.wonCount ?? '—', sub: `avg ${k ? fmtMoney(k.avgDealValue) : ''}`, icon: Trophy, grad: 'gradient-purple', accent: '#a855f7', trend: 'in' },
    { label: 'Deals Lost', value: k?.lostCount ?? '—', sub: 'in period', icon: XCircle, grad: 'gradient-red', accent: '#ef4444', trend: 'out' },
    { label: 'Meetings', value: k?.meetingsScheduled ?? '—', sub: 'scheduled', icon: CalendarClock, grad: 'gradient-cyan', accent: '#06b6d4', trend: 'in' },
    { label: 'Conversion', value: k ? `${k.conversionRate}%` : '—', sub: 'won / closed', icon: Target, grad: 'gradient-amber', accent: '#f59e0b', trend: 'in' },
    { label: 'New Leads', value: k?.createdInRange ?? '—', sub: 'in period', icon: Users, grad: 'gradient-blue', accent: '#f9622a', trend: 'in' },
    { label: 'Calls Logged', value: k?.calls ?? '—', sub: 'in period', icon: Phone, grad: 'gradient-purple', accent: '#8b5cf6', trend: 'in' },
  ];

  return (
    <div className="h-full flex flex-col gap-6 overflow-y-auto pr-1 custom-scrollbar pb-10">
      {/* Header + Date filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Performance overview · {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: preset === p.days ? 'linear-gradient(135deg,#f9622a,#f9622a)' : 'transparent',
                  color: preset === p.days ? '#fff' : '#94a3b8',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <input type="date" value={startDate} max={endDate}
              onChange={(e) => { setStartDate(e.target.value); setPreset(0); }}
              className="bg-transparent border-none text-xs text-slate-600 px-2 cursor-pointer" style={{ colorScheme: 'light' }} />
            <span className="text-slate-600 text-xs">→</span>
            <input type="date" value={endDate} min={startDate} max={new Date().toISOString().split('T')[0]}
              onChange={(e) => { setEndDate(e.target.value); setPreset(0); }}
              className="bg-transparent border-none text-xs text-slate-600 px-2 cursor-pointer" style={{ colorScheme: 'light' }} />
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-40">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCards.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card p-5 relative overflow-hidden group"
              >
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 blur-2xl" style={{ background: c.accent }} />
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 rounded-2xl ${c.grad} flex items-center justify-center shadow-lg`} style={{ boxShadow: `0 8px 20px -8px ${c.accent}` }}>
                    <c.icon className="w-5 h-5 text-slate-900" />
                  </div>
                  {c.trend === 'in'
                    ? <ArrowUpRight className="w-4 h-4 text-green-500/70" />
                    : <ArrowDownRight className="w-4 h-4 text-red-500/70" />}
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{c.value}</p>
                <p className="text-[11px] text-slate-500 font-medium mt-1">{c.label}</p>
                {c.sub && <p className="text-[10px] text-slate-600 mt-0.5">{c.sub}</p>}
              </motion.div>
            ))}
          </div>

          {/* Main trend + status donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card p-6 lg:col-span-2 flex flex-col min-h-[340px]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-orange-500" /></div>
                  <h3 className="text-sm font-bold text-slate-900">Leads Flow — Created vs Won vs Lost</h3>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-orange-500" />Created</span>
                  <span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-green-500" />Won</span>
                  <span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-red-500" />Lost</span>
                </div>
              </div>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.timeseries}>
                    <defs>
                      <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f9622a" stopOpacity={0.3} /><stop offset="95%" stopColor="#f9622a" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gWon" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gLost" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} minTickGap={24}
                      tickFormatter={(s) => new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#6b7280' }} />
                    <Area type="monotone" dataKey="created" stroke="#f9622a" strokeWidth={2} fill="url(#gCreated)" />
                    <Area type="monotone" dataKey="won" stroke="#10b981" strokeWidth={2} fill="url(#gWon)" />
                    <Area type="monotone" dataKey="lost" stroke="#ef4444" strokeWidth={2} fill="url(#gLost)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="card p-6 flex flex-col min-h-[340px]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center"><PieIcon className="w-4 h-4 text-purple-400" /></div>
                <h3 className="text-sm font-bold text-slate-900">Pipeline by Status</h3>
              </div>
              <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data?.statusDistribution} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={4} dataKey="value">
                      {data?.statusDistribution.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_META[entry.name as keyof typeof STATUS_META]?.color || '#64748b'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <p className="text-2xl font-bold text-slate-900">{k?.totalLeads ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Leads</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-4">
                {data?.statusDistribution.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[entry.name as keyof typeof STATUS_META]?.color }} />
                    <span className="text-[10px] text-slate-400 capitalize">{STATUS_META[entry.name as keyof typeof STATUS_META]?.label || entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Revenue + source */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6 lg:col-span-2 flex flex-col min-h-[300px]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center"><DollarSign className="w-4 h-4 text-green-400" /></div>
                <h3 className="text-sm font-bold text-slate-900">Revenue Collected ($)</h3>
              </div>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.timeseries}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} minTickGap={24}
                      tickFormatter={(s) => new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => fmtMoney(v)} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }}
                      formatter={(v: any) => [fmtFullMoney(Number(v)), 'Revenue']} labelStyle={{ color: '#6b7280' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#gRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6 flex flex-col min-h-[300px]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-amber-400" /></div>
                <h3 className="text-sm font-bold text-slate-900">Leads by Source</h3>
              </div>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.sourceDistribution} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={70} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ListCard title="Top Open Deals" icon={<TrendingUp className="w-4 h-4 text-orange-500" />} accent="bg-orange-500/10"
              rows={(data?.topDeals || []).map((d) => ({
                title: d.name, sub: d.company || STATUS_META[d.status as keyof typeof STATUS_META]?.label,
                right: fmtFullMoney(d.dealValue), color: STATUS_META[d.status as keyof typeof STATUS_META]?.color,
              }))} empty="No open deals" />

            <ListCard title="Recent Wins" icon={<Trophy className="w-4 h-4 text-green-400" />} accent="bg-green-500/10"
              rows={(data?.recentWon || []).map((d) => ({
                title: d.name, sub: d.company || 'Closed', right: fmtFullMoney(d.wonValue), color: '#10b981',
              }))} empty="No wins yet" />

            <ListCard title="Upcoming Meetings" icon={<CalendarClock className="w-4 h-4 text-cyan-400" />} accent="bg-cyan-500/10"
              rows={(data?.upcomingMeetings || []).map((m) => ({
                title: (m.leadId as any)?.name || m.title,
                sub: new Date(m.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                right: m.type, color: '#06b6d4',
              }))} empty="No meetings scheduled" />
          </div>
        </>
      )}
    </div>
  );
}

function ListCard({ title, icon, accent, rows, empty }: {
  title: string; icon: React.ReactNode; accent: string;
  rows: { title: string; sub?: string; right?: string; color?: string }[]; empty: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center`}>{icon}</div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-600 py-6 text-center">{empty}</p>
        ) : rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-100 transition-colors">
            <span className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: r.color || '#64748b' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{r.title}</p>
              {r.sub && <p className="text-[10px] text-slate-500 truncate capitalize">{r.sub}</p>}
            </div>
            {r.right && <span className="text-xs font-bold text-slate-600 flex-shrink-0 capitalize">{r.right}</span>}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
