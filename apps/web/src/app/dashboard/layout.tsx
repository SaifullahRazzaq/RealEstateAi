'use client';

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

  if (!ready || !user) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
