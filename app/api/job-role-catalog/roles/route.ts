import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get('sector') || '';
    const tracksParam = searchParams.get('tracks') || '';
    const tracks = tracksParam ? tracksParam.split(',').map(t => t.trim()).filter(Boolean) : [];
    const q = searchParams.get('q') || '';
    const sortDir = searchParams.get('sort') === 'desc' ? 'DESC' : 'ASC';
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);
    const offset = Number(searchParams.get('offset')) || 0;

    const sql = db();

    const rows = sortDir === 'DESC'
      ? await sql`
          SELECT id, sector, track, job_role, job_role_description, performance_expectation
          FROM job_role_catalog
          WHERE (${sector} = '' OR sector = ${sector})
            AND (${tracks.length === 0} OR track = ANY(${tracks}))
            AND (${q} = '' OR job_role ILIKE ${'%' + q + '%'})
          ORDER BY job_role DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT id, sector, track, job_role, job_role_description, performance_expectation
          FROM job_role_catalog
          WHERE (${sector} = '' OR sector = ${sector})
            AND (${tracks.length === 0} OR track = ANY(${tracks}))
            AND (${q} = '' OR job_role ILIKE ${'%' + q + '%'})
          ORDER BY job_role ASC
          LIMIT ${limit} OFFSET ${offset}
        `;

    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM job_role_catalog
      WHERE (${sector} = '' OR sector = ${sector})
        AND (${tracks.length === 0} OR track = ANY(${tracks}))
        AND (${q} = '' OR job_role ILIKE ${'%' + q + '%'})
    `;

    return Response.json({ data: { rows, total: count }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch job roles';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
