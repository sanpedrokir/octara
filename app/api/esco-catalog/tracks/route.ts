import { requireAuth } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get('sector') ?? '';

    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ sub_group: string }>(
        `SELECT DISTINCT sub_group FROM esco_job_catalog
         WHERE isco_group = $1 AND sub_group IS NOT NULL
         ORDER BY sub_group`,
        [sector]
      );
      return Response.json({ data: rows.map(r => r.sub_group), error: null });
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
