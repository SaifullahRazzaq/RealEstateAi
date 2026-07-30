'use client';

import { apiFetch } from '@/lib/api';
import { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  BarChart3, Phone, TrendingUp, Calendar, Users, Loader2, 
  Target, PieChart as PieIcon, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#f9622a', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface Stats {
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  totalCalls: number;
  conversionRate: string | number;
}

interface ActivityData {
  date: string;
  calls: number;
}

interface DistributionData {
  name: string;
  value: number;
}

/** Period-over-period change, already formatted by the API (e.g. "+12.5%"). */
interface Trends {
  totalCalls: string;
  wonLeads: string;
  lostLeads: string;
  conversionRate: string;
}

interface AgentPerformance {
  id: string;
  name: string;
  calls: number;
  won: number;
  lost: number;
  conversion: number;
  growth: string;
}

interface ReportResponse {
  activity: ActivityData[];
  distribution: DistributionData[];
  stats: Stats | null;
  trends: Trends | null;
  agents: AgentPerformance[];
}

export default function ReportPage() {
  const [mounted, setMounted] = useState(false);
  const [activity, setActivity] = useState<ActivityData[]>([]);
  const [distribution, setDistribution] = useState<DistributionData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { setMounted(true); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ReportResponse>(`/api/reports?start=${startDate}&end=${endDate}`);
      setActivity(data.activity || []);
      setDistribution(data.distribution || []);
      setStats(data.stats || null);
      setTrends(data.trends || null);
      setAgents(data.agents || []);
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (mounted) fetchData(); 
  }, [startDate, endDate, mounted]);

  if (!mounted) return null;

  return (
    // `main` already scrolls; nesting a second scroller traps the page.
    <div className="flex flex-col gap-4 sm:gap-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Performance Analytics</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Track your business growth and agent activity</p>
        </div>

        <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 flex-shrink-0">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-none text-xs text-slate-600 focus:ring-0 cursor-pointer px-1"
            style={{ colorScheme: 'light' }}
          />
          <span className="text-slate-400 flex-shrink-0">|</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-none text-xs text-slate-600 focus:ring-0 cursor-pointer px-1"
            style={{ colorScheme: 'light' }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Calls', value: stats?.totalCalls ?? '—', icon: Phone, color: 'text-orange-500', bg: 'bg-orange-500/10', trend: trends?.totalCalls ?? '0%' },
          { label: 'Won Deals', value: stats?.wonLeads ?? '—', icon: Target, color: 'text-green-400', bg: 'bg-green-400/10', trend: trends?.wonLeads ?? '0%' },
          { label: 'Lost Leads', value: stats?.lostLeads ?? '—', icon: ArrowDownRight, color: 'text-red-400', bg: 'bg-red-400/10', trend: trends?.lostLeads ?? '0%' },
          { label: 'Conv. Rate', value: stats ? `${stats.conversionRate}%` : '—', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-400/10', trend: trends?.conversionRate ?? '0%' },
        ].map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="card p-4 sm:p-5 group hover:border-slate-200 transition-all cursor-default"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center transition-transform group-hover:scale-110 flex-shrink-0`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${item.trend.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {item.trend}
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mb-0.5 truncate">{loading ? '...' : item.value}</p>
            <p className="text-xs text-slate-500 font-medium truncate">{item.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Activity Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="card p-4 sm:p-6 lg:col-span-2 flex flex-col min-h-[300px] sm:min-h-[350px]"
        >
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 text-orange-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Call Activity</h3>
            </div>
          </div>

          {/* Recharts measures its parent, so the parent needs a real height */}
          <div className="flex-1 w-full min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f9622a" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f9622a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(str) => new Date(str).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#111827' }}
                />
                <Area type="monotone" dataKey="calls" stroke="#f9622a" strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Lead Distribution Pie Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="card p-4 sm:p-6 flex flex-col min-h-[350px]"
        >
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <PieIcon className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Lead Distribution</h3>
          </div>

          <div className="flex-1 w-full relative min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Stats */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-xl font-bold text-slate-900">{stats?.totalLeads}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total</p>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {distribution.map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-[10px] text-slate-500 capitalize truncate">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Agents Performance Table — live per-agent numbers for the selected range */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card overflow-hidden"
      >
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 truncate">Top Performing Agents</h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">{agents.length} in team</span>
        </div>
        {/* Five comparable numbers per row: the table stays a table and scrolls
            sideways inside its own card rather than widening the page. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold">
                <th className="px-4 sm:px-6 py-3">Agent Name</th>
                <th className="px-4 sm:px-6 py-3 text-center">Calls</th>
                <th className="px-4 sm:px-6 py-3 text-center">Won</th>
                <th className="px-4 sm:px-6 py-3 text-center">Conversion</th>
                <th className="px-4 sm:px-6 py-3 text-right">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {agents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    No agent activity in this period
                  </td>
                </tr>
              )}
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-100 transition-colors">
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full gradient-blue flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-slate-900 font-medium">{agent.name}</span>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-center text-slate-500 font-medium">{agent.calls}</td>
                  <td className="px-4 sm:px-6 py-4 text-center text-slate-500 font-medium">{agent.won}</td>
                  <td className="px-4 sm:px-6 py-4 text-center">
                    <span className="px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 font-bold whitespace-nowrap">{agent.conversion}%</span>
                  </td>
                  <td className={`px-4 sm:px-6 py-4 text-right font-bold ${agent.growth.startsWith('-') ? 'text-red-500' : 'text-green-500'}`}>
                    {agent.growth}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
