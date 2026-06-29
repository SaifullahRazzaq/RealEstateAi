'use client';

import { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { Bell, LogOut, Search, User, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard/new-leads': { title: 'New Leads', subtitle: 'All fresh incoming leads' },
  '/dashboard/daily-task': { title: 'Daily Task', subtitle: "Today's follow-ups and calls" },
  '/dashboard/pipeline': { title: 'Pipeline', subtitle: 'Hot prospects to close' },
  '/dashboard/meeting': { title: 'Meetings', subtitle: 'Scheduled client meetings' },
  '/dashboard/lost-leads': { title: 'Lost Leads', subtitle: 'Not interested contacts' },
  '/dashboard/won-clients': { title: 'Won Clients', subtitle: 'Successfully closed deals' },
  '/dashboard/report': { title: 'Reports', subtitle: 'Activity and call analytics' },
  '/dashboard/users': { title: 'Team Management', subtitle: 'Manage your agents and roles' },
};

const MOCK_NOTIFICATIONS = [
  { id: 1, title: 'New Lead Assigned', message: 'Ahmed Khan has been assigned to you.', time: '2m ago', type: 'info', icon: User },
  { id: 2, title: 'Meeting Reminder', message: 'Meeting with Sara Ahmed in 30 mins.', time: '30m ago', type: 'alert', icon: Clock },
  { id: 3, title: 'Deal Closed!', message: 'Lead "Zainab Bibi" moved to Won.', time: '1h ago', type: 'success', icon: CheckCircle2 },
];

interface TopBarProps {
  user: { name?: string | null; email?: string | null; role?: string };
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname();
  const { searchQuery, setSearchQuery } = useCRMStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNew, setHasNew] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const page = pageTitles[pathname] || { title: 'Dashboard', subtitle: '' };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="flex-shrink-0 flex items-center gap-6 px-8 py-5 border-b z-30"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
      
      {/* Page title */}
      <div className="flex-1">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-xl font-bold text-white leading-tight tracking-tight">{page.title}</h1>
          <p className="text-xs text-slate-500 font-medium">{page.subtitle}</p>
        </motion.div>
      </div>

      {/* Search */}
      <div className="relative w-80 group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
        <input
          id="topbar-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search leads, phone, or tags..."
          className="input-field pl-11 py-3 text-sm bg-slate-900/50 border-slate-800 focus:bg-slate-900 transition-all rounded-2xl"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => { setShowNotifications(!showNotifications); setHasNew(false); }}
            className={cn(
              "relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300",
              showNotifications ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-slate-900/50 text-slate-400 hover:text-white border border-slate-800"
            )}
          >
            <Bell className="w-5 h-5" />
            {hasNew && (
              <span className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-900 animate-pulse" />
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden py-2"
              >
                <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                  <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300">Mark all as read</button>
                </div>
                <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                  {MOCK_NOTIFICATIONS.map((n) => (
                    <div key={n.id} className="px-5 py-4 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 last:border-0 group">
                      <div className="flex gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                          n.type === 'alert' ? "bg-amber-500/10 text-amber-500" : n.type === 'success' ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-400"
                        )}>
                          <n.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">{n.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[9px] text-slate-600 mt-1.5 font-bold uppercase tracking-wider">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 text-center border-t border-slate-800">
                  <button className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors">View All Notifications</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-11 h-11 rounded-2xl gradient-blue flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-500/10">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-300 border border-transparent hover:border-rose-500/20"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
