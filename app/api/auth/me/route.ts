import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return Response.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    }

    const sql = db();
    const [user] = await sql`SELECT id, email, name, role, created_at FROM users WHERE id = ${session.userId}`;
    if (!user) {
      return Response.json({ data: null, error: 'User not found' }, { status: 404 });
    }

    return Response.json({ data: user, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch user';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
