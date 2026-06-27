import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function DELETE() {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'esco_job_catalog') THEN
            TRUNCATE esco_job_catalog, esco_skills_mapping RESTART IDENTITY;
          END IF;
        END $$
      `);
      return Response.json({ data: { success: true, message: 'All ESCO data cleared.' }, error: null });
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Clear failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
