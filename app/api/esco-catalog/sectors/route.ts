import { requireAuth } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAuth();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ isco_group: string }>(
        `SELECT DISTINCT isco_group FROM esco_job_catalog ORDER BY isco_group`
      );
      return Response.json({ data: rows.map(r => r.isco_group), error: null });
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
