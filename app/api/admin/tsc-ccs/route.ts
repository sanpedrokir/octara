import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
    const offset = Number(searchParams.get('offset') ?? 0);
    const track = searchParams.get('track') ?? '';
    const jobRole = searchParams.get('job_role') ?? '';
    const q = searchParams.get('q') ?? '';
    const typeFilter = searchParams.get('type') ?? '';

    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (track) {
      params.push(track);
      conditions.push(`LOWER(TRIM(track)) = LOWER(TRIM($${params.length}))`);
    }
    if (jobRole) {
      params.push(`%${jobRole}%`);
      conditions.push(`LOWER(job_role) LIKE LOWER($${params.length})`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(LOWER(job_role) LIKE LOWER($${params.length}) OR LOWER(skill_title) LIKE LOWER($${params.length}) OR LOWER(skill_code) LIKE LOWER($${params.length}))`);
    }
    if (typeFilter) {
      params.push(typeFilter.toLowerCase());
      conditions.push(`LOWER(skill_type) = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rowsResult, countResult, tracksResult, lastUploadResult] = await Promise.all([
      pool.query(
        `SELECT id, sector, track, job_role, skill_title, skill_type, proficiency_level, skill_code
         FROM job_role_tsc_ccs ${where}
         ORDER BY track, job_role, skill_type, proficiency_level::int NULLS LAST
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM job_role_tsc_ccs ${where}`, params),
      pool.query(`SELECT DISTINCT track FROM job_role_tsc_ccs WHERE track IS NOT NULL ORDER BY track`),
      pool.query(
        `SELECT filename, row_count, skipped_count, created_at
         FROM job_role_catalog_uploads ORDER BY created_at DESC LIMIT 1`
      ),
    ]);

    return Response.json({
      data: {
        rows: rowsResult.rows,
        total: Number(countResult.rows[0].count),
        tracks: tracksResult.rows.map((r: { track: string }) => r.track),
        lastUpload: lastUploadResult.rows[0] ?? null,
      },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
