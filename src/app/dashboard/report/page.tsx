'use client';

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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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

export default function ReportPage() {
  const [mounted, setMounted] = useState(false);
  const [activity, setActivity] = useState<ActivityData[]>([]);
  const [distribution, setDistribution] = useState<DistributionData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
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
      const res = await fetch(`/api/reports?start=${startDate}&end=${endDate}`);
      const data = await res.json();
      setActivity(data.activity || []);
      setDistribution(data.distribution || []);
      setStats(data.stats || null);
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
    <div className="h-full flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Performance Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track your business growth and agent activity</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800">
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="bg-transparent border-none text-xs text-slate-300 focus:ring-0 cursor-pointer"
            style={{ colorScheme: 'dark' }}
          />
          <span className="text-slate-700">|</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="bg-transparent border-none text-xs text-slate-300 focus:ring-0 cursor-pointer"
            style={{ colorScheme: 'dark' }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Calls', value: stats?.totalCalls, icon: Phone, color: 'text-blue-400', bg: 'bg-blue-400/10', trend: '+12%' },
          { label: 'Won Deals', value: stats?.wonLeads, icon: Target, color: 'text-green-400', bg: 'bg-green-400/10', trend: '+5%' },
          { label: 'Lost Leads', value: stats?.lostLeads, icon: ArrowDownRight, color: 'text-red-400', bg: 'bg-red-400/10', trend: '-2%' },
          { label: 'Conv. Rate', value: `${stats?.conversionRate}%`, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-400/10', trend: '+3%' },
        ].map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="card p-5 group hover:border-slate-700 transition-all cursor-default"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${item.trend.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {item.trend}
              </span>
            </div>
            <p className="text-2xl font-bold text-white mb-0.5">{loading ? '...' : item.value}</p>
            <p className="text-xs text-slate-500 font-medium">{item.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Activity Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="card p-6 lg:col-span-2 flex flex-col min-h-[350px]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Call Activity</h3>
            </div>
          </div>
          
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
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
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="calls" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Lead Distribution Pie Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="card p-6 flex flex-col min-h-[350px]"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <PieIcon className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Lead Distribution</h3>
          </div>

          <div className="flex-1 w-full relative">
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
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Stats */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-xl font-bold text-white">{stats?.totalLeads}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total</p>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {distribution.map((entry, idx) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-[10px] text-slate-400 capitalize">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Agents Performance Table (Placeholder for now) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-white">Top Performing Agents</h3>
          </div>
          <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-900/50 text-slate-500 font-semibold">
                <th className="px-6 py-3">Agent Name</th>
                <th className="px-6 py-3 text-center">Calls</th>
                <th className="px-6 py-3 text-center">Conversion</th>
                <th className="px-6 py-3 text-right">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[
                { name: 'Ahmed Khan', calls: 450, conv: '12.5%', growth: '+8%' },
                { name: 'Sara Ahmed', calls: 380, conv: '11.2%', growth: '+15%' },
                { name: 'Zubair Sheikh', calls: 310, conv: '9.8%', growth: '-2%' },
              ].map((agent) => (
                <tr key={agent.name} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full gradient-blue flex items-center justify-center text-[10px] font-bold text-white">
                        {agent.name.charAt(0)}
                      </div>
                      <span className="text-slate-200 font-medium">{agent.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-400 font-medium">{agent.calls}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 font-bold">{agent.conv}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-green-500">{agent.growth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
