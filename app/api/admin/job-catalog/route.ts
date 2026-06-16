import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'admin') {
    return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sector = searchParams.get('sector') || '';
  const q = searchParams.get('q') || '';
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
  const offset = Number(searchParams.get('offset')) || 0;

  const sql = db();

  const rows = await sql`
    SELECT id, sector, track, job_role, job_role_description, performance_expectation
    FROM job_role_catalog
    WHERE (${sector} = '' OR sector = ${sector})
      AND (${q} = '' OR job_role ILIKE ${'%' + q + '%'})
    ORDER BY sector, track, job_role
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM job_role_catalog
    WHERE (${sector} = '' OR sector = ${sector})
      AND (${q} = '' OR job_role ILIKE ${'%' + q + '%'})
  `;

  const sectors = await sql`SELECT DISTINCT sector FROM job_role_catalog ORDER BY sector`;

  const [lastUpload] = await sql`
    SELECT filename, row_count, skipped_count, created_at
    FROM job_role_catalog_uploads
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return Response.json({
    data: {
      rows,
      total: count,
      sectors: sectors.map(s => s.sector),
      lastUpload: lastUpload ?? null,
    },
    error: null,
  });
}
