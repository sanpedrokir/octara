import { db } from '@/lib/db';

export async function GET() {
  try {
    const sql = db();
    const rows = await sql`
      SELECT DISTINCT sector FROM job_role_catalog
      WHERE sector IS NOT NULL AND sector != ''
      ORDER BY sector
    `;
    return Response.json({ data: rows.map(r => r.sector), error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch sectors';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
