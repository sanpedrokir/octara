import { requireAuth } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get('sector') ?? '';
    const tracks = searchParams.get('tracks') ?? '';
    const q      = searchParams.get('q') ?? '';
    const limit  = Math.min(Number(searchParams.get('limit') ?? 500), 500);
    const offset = Number(searchParams.get('offset') ?? 0);

    const pool = getPool();
    const client = await pool.connect();
    try {
      const params: unknown[] = [sector];
      const conditions: string[] = ['isco_group = $1'];

      if (tracks) {
        const trackList = tracks.split(',').map(t => t.trim()).filter(Boolean);
        if (trackList.length > 0) {
          params.push(trackList);
          conditions.push(`sub_group = ANY($${params.length})`);
        }
      }
      if (q) {
        params.push(`%${q}%`);
        conditions.push(`occupation_title ILIKE $${params.length}`);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;

      const countRes = await client.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM esco_job_catalog ${where}`, params
      );
      const total = countRes.rows[0].n;

      params.push(limit, offset);
      const dataRes = await client.query(
        `SELECT id,
                isco_group  AS sector,
                sub_group   AS track,
                occupation_title AS job_role,
                NULL::text  AS job_role_description,
                NULL::text  AS performance_expectation,
                esco_uri
         FROM esco_job_catalog ${where}
         ORDER BY occupation_title
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return Response.json({ data: { rows: dataRes.rows, total }, error: null });
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
