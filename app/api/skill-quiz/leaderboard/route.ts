import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get('sector')?.trim();
    if (!sector) return Response.json({ data: null, error: 'sector required' }, { status: 400 });

    const sql = db();

    // Best score per user for this sector
    const rows = await sql`
      SELECT
        u.id AS user_id,
        u.name,
        MAX(sqr.score)::int                                           AS best_score,
        sqr.total,
        ROUND(MAX(sqr.score)::numeric / NULLIF(sqr.total,0) * 100)::int AS pct,
        BOOL_OR(sqr.passed)                                           AS ever_passed,
        COUNT(*)::int                                                 AS attempts
      FROM skill_quiz_results sqr
      JOIN users u ON u.id = sqr.user_id
      WHERE LOWER(TRIM(sqr.skill_name)) = LOWER(TRIM(${sector}))
      GROUP BY u.id, u.name, sqr.total
      ORDER BY best_score DESC, attempts ASC
      LIMIT 20
    ` as Array<{
      user_id: number;
      name: string;
      best_score: number;
      total: number;
      pct: number;
      ever_passed: boolean;
      attempts: number;
    }>;

    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1, is_me: r.user_id === session.userId }));
    const myEntry = ranked.find(r => r.is_me) ?? null;

    return Response.json({ data: { rankings: ranked, me: myEntry }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
