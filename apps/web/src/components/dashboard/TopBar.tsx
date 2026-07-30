'use client';

import { apiFetch } from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Bell, LogOut, Search, User, CheckCircle2, AlertCircle, Clock, Menu, X } from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Sales performance overview' },
  '/dashboard/new-leads': { title: 'New Leads', subtitle: 'All fresh incoming leads' },
  '/dashboard/in-contact': { title: 'In Contact', subtitle: 'Leads currently being engaged' },
  '/dashboard/daily-task': { title: 'Daily Task', subtitle: "Today's follow-ups and calls" },
  '/dashboard/pipeline': { title: 'Pipeline', subtitle: 'Hot prospects to close' },
  '/dashboard/meeting': { title: 'Meetings', subtitle: 'Scheduled client meetings' },
  '/dashboard/lost-leads': { title: 'Lost Leads', subtitle: 'Not interested contacts' },
  '/dashboard/won-clients': { title: 'Won Clients', subtitle: 'Successfully closed deals' },
  '/dashboard/report': { title: 'Reports', subtitle: 'Activity and call analytics' },
  '/dashboard/users': { title: 'Team Management', subtitle: 'Manage your agents and roles' },
};

type NotificationType = 'meeting' | 'overdue' | 'won' | 'new';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  at: string;
}

const NOTIFICATION_STYLE: Record<NotificationType, { icon: React.ElementType; className: string }> = {
  meeting: { icon: Clock, className: 'bg-cyan-500/10 text-cyan-500' },
  overdue: { icon: AlertCircle, className: 'bg-amber-500/10 text-amber-500' },
  won: { icon: CheckCircle2, className: 'bg-green-500/10 text-green-500' },
  new: { icon: User, className: 'bg-orange-500/10 text-orange-500' },
};

/** "in 30m" for the future, "2h ago" for the past. */
function relativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const future = diffMs > 0;
  const mins = Math.round(Math.abs(diffMs) / 60000);

  let value: string;
  if (mins < 1) value = 'now';
  else if (mins < 60) value = `${mins}m`;
  else if (mins < 1440) value = `${Math.round(mins / 60)}h`;
  else value = `${Math.round(mins / 1440)}d`;

  if (value === 'now') return 'just now';
  return future ? `in ${value}` : `${value} ago`;
}

interface TopBarProps {
  user: { name?: string | null; email?: string | null; role?: string };
  /** Opens the overlay sidebar. Only reachable below lg, where it's rendered. */
  onMenuClick?: () => void;
}

export function TopBar({ user, onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const { searchQuery, setSearchQuery } = useCRMStore();
  const { logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [seenCount, setSeenCount] = useState(0);
  // Below md the search moves to its own row, revealed on demand — the header
  // row has no width left for it, and search is not a per-page control.
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const page = pageTitles[pathname] || { title: 'Dashboard', subtitle: '' };
  const hasNew = notifications.length > seenCount;

  // Refetched on every navigation so the badge reflects current data.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ notifications: Notification[] }>('/api/notifications');
        if (!cancelled) setNotifications(data.notifications || []);
      } catch {
        /* a failed badge fetch must never break the page */
      } finally {
        if (!cancelled) setLoadingNotifications(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

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
    <header className="flex-shrink-0 border-b z-30"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 sm:gap-6 px-4 sm:px-8 py-3 sm:py-5">

        {/* Opens the overlay sidebar; the sidebar is permanent from lg up. */}
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="lg:hidden w-10 h-10 -ml-1 rounded-2xl flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page title — min-w-0 lets it truncate rather than push the row wide. */}
        <div className="flex-1 min-w-0">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-tight tracking-tight truncate">{page.title}</h1>
            <p className="text-xs text-slate-500 font-medium truncate hidden sm:block">{page.subtitle}</p>
          </motion.div>
        </div>

        {/* Search — inline from md up, a toggled second row below that. */}
        <div className="relative hidden md:block md:w-56 lg:w-80 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
          <input
            id="topbar-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads, phone, or tags..."
            className="input-field pl-11 py-3 text-sm bg-slate-50 border-slate-200 focus:bg-white transition-all rounded-2xl"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => setShowMobileSearch((v) => !v)}
            aria-label={showMobileSearch ? 'Close search' : 'Search leads'}
            className={cn(
              'md:hidden w-10 h-10 rounded-2xl flex items-center justify-center border transition-all flex-shrink-0',
              showMobileSearch || searchQuery
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            )}
          >
            {showMobileSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => { setShowNotifications(!showNotifications); setSeenCount(notifications.length); }}
              aria-label="Notifications"
              className={cn(
                "relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all duration-300",
                showNotifications ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200"
              )}
            >
              <Bell className="w-5 h-5" />
              {hasNew && (
                <span className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-[calc(100vw-2rem)] max-w-sm sm:w-80 bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden py-2"
                >
                  <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Notifications</span>
                    <span className="text-[10px] font-bold text-slate-400">{notifications.length}</span>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                    {loadingNotifications && (
                      <p className="px-5 py-8 text-center text-[11px] text-slate-400">Loading…</p>
                    )}
                    {!loadingNotifications && notifications.length === 0 && (
                      <p className="px-5 py-8 text-center text-[11px] text-slate-400">You&apos;re all caught up</p>
                    )}
                    {notifications.map((n) => {
                      const style = NOTIFICATION_STYLE[n.type] ?? NOTIFICATION_STYLE.new;
                      const Icon = style.icon;
                      return (
                        <div key={n.id} className="px-5 py-4 hover:bg-slate-100 transition-colors cursor-pointer border-b border-slate-200 last:border-0 group">
                          <div className="flex gap-3">
                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', style.className)}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 group-hover:text-orange-500 transition-colors">{n.title}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[9px] text-slate-600 mt-1.5 font-bold uppercase tracking-wider">{relativeTime(n.at)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User menu — the avatar is duplicated in the sidebar footer, so on a
              phone it gives up its width to the controls that do something. */}
          <div className="flex items-center gap-2 sm:pl-2 sm:border-l border-slate-200">
            <div className="hidden sm:flex w-11 h-11 rounded-2xl gradient-blue items-center justify-center text-white text-sm font-bold shadow-lg shadow-orange-500/10">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <button
              onClick={() => logout()}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all duration-300 border border-transparent hover:border-rose-500/20"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile search row */}
      <AnimatePresence initial={false}>
        {showMobileSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden"
          >
            <div className="px-4 pb-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                <input
                  id="topbar-search-mobile"
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search leads, phone, or tags…"
                  className="input-field pl-11 py-3 bg-slate-50 border-slate-200 focus:bg-white rounded-2xl"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
