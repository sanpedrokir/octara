import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

async function tablesExist(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT to_regclass('esco_job_catalog') AS t`
  );
  return !!(rows[0] as { t: string | null }).t;
}

export async function GET(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit   = Math.min(Number(searchParams.get('limit')  ?? 50), 200);
    const offset  = Number(searchParams.get('offset') ?? 0);
    const q       = searchParams.get('q') ?? '';
    const group   = searchParams.get('group') ?? '';
    const view    = searchParams.get('view') ?? 'occupations'; // 'occupations' | 'skills'

    const pool = getPool();
    const client = await pool.connect();
    try {
      if (!(await tablesExist(client as unknown as Parameters<typeof tablesExist>[0]))) {
        return Response.json({ data: { rows: [], total: 0, groups: [], lastUpload: null, stats: { occupations: 0, skills: 0 } }, error: null });
      }

      // Last upload
      const uploadRows = await client.query(
        `SELECT filename, occ_count, skill_count, skipped_count, created_at FROM esco_uploads ORDER BY created_at DESC LIMIT 1`
      );
      const lastUpload = (uploadRows.rows[0] as Record<string, unknown>) ?? null;

      // Stats
      const statRows = await client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM esco_job_catalog)   AS occupations,
           (SELECT COUNT(*)::int FROM esco_skills_mapping) AS skills`
      );
      const stats = statRows.rows[0] as { occupations: number; skills: number };

      // Distinct ISCO groups for filter
      const groupRows = await client.query(
        `SELECT DISTINCT isco_group FROM esco_job_catalog ORDER BY isco_group`
      );
      const groups = (groupRows.rows as { isco_group: string }[]).map(r => r.isco_group);

      let rows: unknown[] = [];
      let total = 0;

      if (view === 'occupations') {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (group) { conditions.push(`isco_group = $${params.length + 1}`); params.push(group); }
        if (q) { conditions.push(`occupation_title ILIKE $${params.length + 1}`); params.push(`%${q}%`); }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const countRes = await client.query(`SELECT COUNT(*)::int AS n FROM esco_job_catalog ${where}`, params);
        total = (countRes.rows[0] as { n: number }).n;

        const dataRes = await client.query(
          `SELECT id, isco_group, sub_group, occupation_title, occupation_description, esco_uri
           FROM esco_job_catalog ${where} ORDER BY isco_group, occupation_title
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]
        );
        rows = dataRes.rows;
      } else {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (group) { conditions.push(`isco_group = $${params.length + 1}`); params.push(group); }
        if (q) { conditions.push(`(skill_title ILIKE $${params.length + 1} OR occupation_title ILIKE $${params.length + 1})`); params.push(`%${q}%`); }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const countRes = await client.query(`SELECT COUNT(*)::int AS n FROM esco_skills_mapping ${where}`, params);
        total = (countRes.rows[0] as { n: number }).n;

        const dataRes = await client.query(
          `SELECT id, isco_group, occupation_title, skill_title, skill_type, esco_skill_uri
           FROM esco_skills_mapping ${where} ORDER BY occupation_title, skill_title
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]
        );
        rows = dataRes.rows;
      }

      return Response.json({ data: { rows, total, groups, lastUpload, stats }, error: null });
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
