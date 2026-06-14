import { getCurrentUser } from '@/lib/auth';
import { db, DB_SCHEMA, getPool } from '@/lib/db';

export async function POST() {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const pool = getPool();
    await pool.query(DB_SCHEMA);
    return Response.json({ data: { success: true, message: 'Database schema created successfully' }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database init failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
