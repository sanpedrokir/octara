import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();

    // Ensure the results table exists before querying
    await sql`
      CREATE TABLE IF NOT EXISTS skill_quiz_results (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL,
        skill_name TEXT NOT NULL,
        score      INTEGER NOT NULL,
        total      INTEGER NOT NULL,
        passed     BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Rank all users who have attempted at least one quiz.
    // Primary rank: quizzes passed. Secondary: average score %.
    // Anonymise: expose first name + last-name initial only.
    const rows = await sql`
      WITH stats AS (
        SELECT
          u.id                                                          AS user_id,
          u.name                                                        AS full_name,
          COUNT(sqr.id)::int                                            AS total_attempts,
          COUNT(sqr.id) FILTER (WHERE sqr.passed)::int                  AS quizzes_passed,
          ROUND(AVG(sqr.score::float / NULLIF(sqr.total,0) * 100))::int AS avg_pct,
          MAX(sqr.score::float / NULLIF(sqr.total,0) * 100)::int        AS best_pct
        FROM users u
        JOIN skill_quiz_results sqr ON sqr.user_id = u.id
        GROUP BY u.id, u.name
      )
      SELECT
        RANK() OVER (
          ORDER BY quizzes_passed DESC, avg_pct DESC
        )::int  AS rank,
        user_id,
        full_name,
        total_attempts,
        quizzes_passed,
        avg_pct,
        best_pct,
        (user_id = ${session.userId}) AS is_me
      FROM stats
      ORDER BY rank ASC, full_name ASC
      LIMIT 20
    ` as Array<{
      rank: number;
      user_id: number;
      full_name: string;
      total_attempts: number;
      quizzes_passed: number;
      avg_pct: number;
      best_pct: number;
      is_me: boolean;
    }>;

    // If current user is outside top 20, fetch their position separately
    let myRow: (typeof rows)[0] | null = null;
    const inTop20 = rows.some(r => r.is_me);

    if (!inTop20) {
      const myStats = await sql`
        WITH stats AS (
          SELECT
            u.id                                                          AS user_id,
            u.name                                                        AS full_name,
            COUNT(sqr.id)::int                                            AS total_attempts,
            COUNT(sqr.id) FILTER (WHERE sqr.passed)::int                  AS quizzes_passed,
            ROUND(AVG(sqr.score::float / NULLIF(sqr.total,0) * 100))::int AS avg_pct,
            MAX(sqr.score::float / NULLIF(sqr.total,0) * 100)::int        AS best_pct
          FROM users u
          JOIN skill_quiz_results sqr ON sqr.user_id = u.id
          GROUP BY u.id, u.name
        ),
        ranked AS (
          SELECT *, RANK() OVER (ORDER BY quizzes_passed DESC, avg_pct DESC)::int AS rank
          FROM stats
        )
        SELECT *, true AS is_me FROM ranked WHERE user_id = ${session.userId}
      ` as typeof rows;
      myRow = myStats[0] ?? null;
    }

    // Anonymise names: "Kirsten Yong" → "Kirsten Y."
    function anonymise(name: string, isMe: boolean): string {
      if (isMe) return name; // show full name to the user themselves
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0];
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }

    const leaderboard = rows.map(r => ({
      rank:           r.rank,
      name:           anonymise(r.full_name, r.is_me),
      total_attempts: r.total_attempts,
      quizzes_passed: r.quizzes_passed,
      avg_pct:        r.avg_pct,
      best_pct:       r.best_pct,
      is_me:          r.is_me,
    }));

    const myEntry = myRow
      ? {
          rank:           myRow.rank,
          name:           myRow.full_name,
          total_attempts: myRow.total_attempts,
          quizzes_passed: myRow.quizzes_passed,
          avg_pct:        myRow.avg_pct,
          best_pct:       myRow.best_pct,
          is_me:          true,
        }
      : null;

    return Response.json({ data: { leaderboard, myEntry, inTop20 }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
