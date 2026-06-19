import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS skill_quiz_results (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      skill_name VARCHAR(255),
      score      INTEGER NOT NULL,
      total      INTEGER NOT NULL,
      passed     BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET(request: Request) {
  try {
    await ensureTable();
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get('sector')?.trim();
    if (!sector) return Response.json({ data: null, error: 'sector required' }, { status: 400 });

    const sql = db();

    // Best attempt per user (by score desc, then most recent), plus attempt count
    const rows = await sql`
      WITH best AS (
        SELECT DISTINCT ON (user_id)
          user_id,
          score,
          total,
          passed,
          ROUND(score::numeric / NULLIF(total, 0) * 100)::int AS pct
        FROM skill_quiz_results
        WHERE LOWER(TRIM(skill_name)) = LOWER(TRIM(${sector}))
        ORDER BY user_id, score DESC, created_at DESC
      ),
      counts AS (
        SELECT user_id, COUNT(*)::int AS attempts, BOOL_OR(passed) AS ever_passed
        FROM skill_quiz_results
        WHERE LOWER(TRIM(skill_name)) = LOWER(TRIM(${sector}))
        GROUP BY user_id
      )
      SELECT u.id AS user_id, u.name,
             b.score AS best_score, b.total, b.pct,
             c.ever_passed, c.attempts
      FROM best b
      JOIN counts c ON c.user_id = b.user_id
      JOIN users u  ON u.id = b.user_id
      ORDER BY b.score DESC, c.attempts ASC
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
