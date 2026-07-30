'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, CalendarCheck, TrendingUp, Video, XCircle, Trophy, BarChart3, Building2, ChevronRight, ShieldCheck, LayoutDashboard, PhoneCall, Handshake
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: 'text-orange-500' },
  { label: 'New Leads', href: '/dashboard/new-leads', icon: Users, color: 'text-orange-500' },
  { label: 'In Contact', href: '/dashboard/in-contact', icon: PhoneCall, color: 'text-cyan-400' },
  { label: 'Daily Task', href: '/dashboard/daily-task', icon: CalendarCheck, color: 'text-amber-400' },
  { label: 'Pipeline', href: '/dashboard/pipeline', icon: TrendingUp, color: 'text-purple-400' },
  { label: 'Meeting', href: '/dashboard/meeting', icon: Video, color: 'text-cyan-400' },
  { label: 'Token / Bayana', href: '/dashboard/token', icon: Handshake, color: 'text-teal-500' },
  { label: 'Lost Leads', href: '/dashboard/lost-leads', icon: XCircle, color: 'text-red-400' },
  { label: 'Won Clients', href: '/dashboard/won-clients', icon: Trophy, color: 'text-green-400' },
  { label: 'Report', href: '/dashboard/report', icon: BarChart3, color: 'text-indigo-400' },
];

const adminItems = [
  { label: 'Team Management', href: '/dashboard/users', icon: ShieldCheck, color: 'text-rose-400' },
];

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: string; companyId?: string };
  /** Mobile/tablet only — below lg the sidebar is an overlay, not a column. */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ user, open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = user?.role === 'admin';

  // Tapping a link on mobile should get out of the way; on desktop the sidebar
  // is permanent and there is nothing to close.
  const handleNavigate = () => onClose?.();

  return (
    <>
      {/* Backdrop — only rendered while the overlay sidebar is open. */}
      {open && (
        <div
          onClick={onClose}
          aria-hidden
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      <aside
        className={cn(
          // Below lg: fixed overlay that slides in. From lg: a normal column.
          'fixed inset-y-0 left-0 z-40 w-64 max-w-[85vw] flex-shrink-0 flex flex-col border-r shadow-2xl',
          'transition-transform duration-300 lg:static lg:translate-x-0 lg:z-20',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
      >
      
      {/* Logo */}
      <div className="px-6 pb-6 border-b" style={{ borderColor: 'var(--border)', paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl gradient-blue flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight tracking-tight">SaleDila CRM</p>
            <p className="text-[10px] text-orange-500/80 font-bold uppercase tracking-widest mt-0.5">{user?.role}</p>
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
                  onClick={handleNavigate}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative',
                    isActive
                      ? 'bg-orange-600 text-white border border-orange-700 shadow-sm shadow-orange-600/30'
                      : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <item.icon className={cn('w-4.5 h-4.5 flex-shrink-0 transition-transform group-hover:scale-110', isActive ? 'text-white' : 'text-slate-500 group-hover:' + item.color)} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-5 bg-white rounded-r-full" />
                  )}
                  {isActive && <ChevronRight className="w-3 h-3 text-white" />}
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
                    onClick={handleNavigate}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative',
                      isActive
                        ? 'bg-orange-600 text-white border border-orange-700 shadow-sm shadow-orange-600/30'
                        : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                    )}
                  >
                    <item.icon className={cn('w-4.5 h-4.5 flex-shrink-0 transition-transform group-hover:scale-110', isActive ? 'text-white' : 'text-slate-500 group-hover:' + item.color)} />
                    <span className="flex-1">{item.label}</span>
                    {isActive && (
                      <motion.div layoutId="activeNavAdmin" className="absolute left-0 w-1 h-5 bg-white rounded-r-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* User info at bottom */}
      <div className="px-3 pt-4 pb-4 border-t" style={{ borderColor: 'var(--border)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all cursor-pointer group">
          <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
      </aside>
    </>
  );
}
