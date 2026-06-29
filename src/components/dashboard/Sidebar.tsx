'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, CalendarCheck, TrendingUp, Video, XCircle, Trophy, BarChart3, Building2, ChevronRight, Settings, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const navItems = [
  { label: 'New Leads', href: '/dashboard/new-leads', icon: Users, color: 'text-blue-400' },
  { label: 'Daily Task', href: '/dashboard/daily-task', icon: CalendarCheck, color: 'text-amber-400' },
  { label: 'Pipeline', href: '/dashboard/pipeline', icon: TrendingUp, color: 'text-purple-400' },
  { label: 'Meeting', href: '/dashboard/meeting', icon: Video, color: 'text-cyan-400' },
  { label: 'Lost Leads', href: '/dashboard/lost-leads', icon: XCircle, color: 'text-red-400' },
  { label: 'Won Clients', href: '/dashboard/won-clients', icon: Trophy, color: 'text-green-400' },
  { label: 'Report', href: '/dashboard/report', icon: BarChart3, color: 'text-indigo-400' },
];

const adminItems = [
  { label: 'Team Management', href: '/dashboard/users', icon: ShieldCheck, color: 'text-rose-400' },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, color: 'text-slate-400' },
];

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: string; companyId?: string };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-r shadow-2xl z-20"
      style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}>
      
      {/* Logo */}
      <div className="px-6 py-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl gradient-blue flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight tracking-tight">SaleDila CRM</p>
            <p className="text-[10px] text-blue-400/80 font-bold uppercase tracking-widest mt-0.5">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-8 overflow-y-auto custom-scrollbar">
        
        <div>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] px-3 mb-4">Management</p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative',
                    isActive
                      ? 'bg-blue-500/10 text-white border border-blue-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <item.icon className={cn('w-4.5 h-4.5 flex-shrink-0 transition-transform group-hover:scale-110', isActive ? item.color : 'text-slate-500 group-hover:' + item.color)} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-5 bg-blue-500 rounded-r-full" />
                  )}
                  {isActive && <ChevronRight className="w-3 h-3 text-blue-400" />}
                </Link>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] px-3 mb-4">Administration</p>
            <div className="space-y-1">
              {adminItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative',
                      isActive
                        ? 'bg-blue-500/10 text-white border border-blue-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <item.icon className={cn('w-4.5 h-4.5 flex-shrink-0 transition-transform group-hover:scale-110', isActive ? item.color : 'text-slate-500 group-hover:' + item.color)} />
                    <span className="flex-1">{item.label}</span>
                    {isActive && (
                      <motion.div layoutId="activeNavAdmin" className="absolute left-0 w-1 h-5 bg-rose-500 rounded-r-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* User info at bottom */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer group">
          <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
