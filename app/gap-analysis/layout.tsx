import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Navbar from '../ui/Navbar';
import DashboardSidebar from '../ui/DashboardSidebar';
import MobileNav from '../ui/MobileNav';
import { db } from '@/lib/db';

export default async function GapAnalysisLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session) redirect('/login');

  const sql = db();
  const [user] = await sql`SELECT name, email, role FROM users WHERE id = ${session.userId}` as Array<{ name: string; email: string; role: string }>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={user ?? null} />
      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <DashboardSidebar role={user?.role} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>
      </div>
      <MobileNav role={user?.role} />
    </div>
  );
}
