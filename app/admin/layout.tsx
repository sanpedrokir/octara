import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Navbar from '../ui/Navbar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'admin') redirect('/dashboard');

  const sql = db();
  const rows = await sql`SELECT id, email, name, role FROM users WHERE id = ${session.userId}`;
  const user = rows[0] as { name: string; email: string; role: string } | undefined;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={user ?? null} />
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </div>
    </div>
  );
}
