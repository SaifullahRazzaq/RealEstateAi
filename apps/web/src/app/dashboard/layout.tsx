'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { useAuth } from '@/components/AuthProvider';

/**
 * Now a client component: with the backend split out, the session lives in a
 * token the browser holds, so there is no server-side `auth()` to await.
 * `proxy.ts` has already redirected unauthenticated visitors before this renders.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  // Below lg the sidebar is an overlay, so the shell owns whether it's showing.
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Close it on navigation — a route change from anywhere (not just a nav tap)
  // should leave the overlay behind.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (!ready || !user) {
    return (
      <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />
      {/* min-w-0 stops a wide child (a table, a long lead name) from forcing the
          whole shell wider than the viewport and scrolling the page sideways. */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar user={user} onMenuClick={() => setNavOpen(true)} />
        {/* The one scroll container for page content, and the one place that
            owes the home indicator its inset. */}
        <main
          className="flex-1 overflow-y-auto p-4 sm:p-6"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
