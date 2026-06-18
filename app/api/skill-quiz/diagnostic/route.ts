import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/skill-quiz/diagnostic
// Returns the distinct sector values in the DB and a sample question per sector
// so you can verify what's actually stored.
export async function GET() {
  try {
    await requireAuth();
    const sql = db();

    // All distinct sectors and their counts
    const sectors = await sql`
      SELECT sector, COUNT(*)::int AS total
      FROM sector_scenario_questions
      GROUP BY sector
      ORDER BY sector ASC
    ` as Array<{ sector: string; total: number }>;

    // One sample question per sector (first alphabetically) to verify content
    const samples = await sql`
      SELECT DISTINCT ON (sector) sector, question
      FROM sector_scenario_questions
      ORDER BY sector ASC, id ASC
    ` as Array<{ sector: string; question: string }>;

    return Response.json({
      data: { sectors, samples },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
