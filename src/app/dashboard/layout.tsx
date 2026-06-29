import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/login');

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar user={session.user as any} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={session.user as any} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
