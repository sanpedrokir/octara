import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const rawSector = searchParams.get('sector')?.trim();
    if (!rawSector) return Response.json({ data: null, error: 'sector required' }, { status: 400 });

    const sql = db();

    // Resolve the exact sector string stored in the DB (handles whitespace/case drift).
    // This guarantees we're querying on the real stored value, not a client-side guess.
    const exactRows = await sql`
      SELECT DISTINCT sector
      FROM sector_scenario_questions
      WHERE TRIM(LOWER(sector)) = TRIM(LOWER(${rawSector}))
      LIMIT 1
    ` as Array<{ sector: string }>;

    if (!exactRows.length) {
      return Response.json(
        { data: null, error: `No questions found for sector "${rawSector}". Check the question bank.` },
        { status: 404 }
      );
    }

    const resolvedSector = exactRows[0].sector;

    // Strict exact match on the resolved sector value — no cross-sector bleed.
    const rows = await sql`
      SELECT id, sector, question, option_a, option_b, option_c, option_d,
             correct_answer, explanation, difficulty
      FROM sector_scenario_questions
      WHERE sector = ${resolvedSector}
      ORDER BY RANDOM()
      LIMIT 30
    `;

    return Response.json({
      data: rows,
      meta: { resolvedSector, total: rows.length },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
