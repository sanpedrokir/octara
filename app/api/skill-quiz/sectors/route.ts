import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    await requireAuth();
    const sql = db();
    const rows = await sql`
      SELECT sector, COUNT(*)::int AS count
      FROM sector_scenario_questions
      GROUP BY sector
      HAVING COUNT(*) > 0
      ORDER BY sector ASC
    `;
    return Response.json({ data: rows, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
