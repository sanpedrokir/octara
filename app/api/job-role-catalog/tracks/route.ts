import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get('sector') || '';
    if (!sector) {
      return Response.json({ data: [], error: null });
    }

    // Returns the raw distinct track values exactly as stored — matches the SSG portal's own
    // behaviour, which lists compound combinations (e.g. "Infrastructure / Software and Applications")
    // as their own distinct, selectable entries rather than splitting them into atomic track names.
    const sql = db();
    const rows = await sql`
      SELECT DISTINCT track FROM job_role_catalog
      WHERE sector = ${sector} AND track IS NOT NULL AND track != ''
      ORDER BY track
    `;
    return Response.json({ data: rows.map(r => r.track), error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch tracks';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
