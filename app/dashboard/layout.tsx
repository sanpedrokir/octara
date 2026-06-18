import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Navbar from '../ui/Navbar';
import MobileNav from '../ui/MobileNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session) redirect('/login');

  const sql = db();
  const rows = await sql`SELECT id, email, name, role FROM users WHERE id = ${session.userId}`;
  const user = rows[0] as { name: string; email: string; role: string } | undefined;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={user ?? null} />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-10">
        {children}
      </main>
      <MobileNav role={user?.role} />
    </div>
  );
}
