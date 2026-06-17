import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();

    await sql`
      CREATE TABLE IF NOT EXISTS skill_quiz_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        skill_name TEXT NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL DEFAULT 20,
        passed BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const [assessment] = await sql`
      SELECT skill_gaps FROM skill_assessments
      WHERE user_id = ${session.userId}
      ORDER BY created_at DESC LIMIT 1
    `;

    let skillGaps: Array<{ skill: string; priority: string; reason?: string }> = [];

    if (assessment?.skill_gaps) {
      skillGaps = assessment.skill_gaps as typeof skillGaps;
    } else {
      const [roadmap] = await sql`
        SELECT skill_gaps FROM learning_roadmaps
        WHERE user_id = ${session.userId}
        ORDER BY created_at DESC LIMIT 1
      `;
      if (roadmap?.skill_gaps) skillGaps = roadmap.skill_gaps as typeof skillGaps;
    }

    const results = await sql`
      SELECT skill_name,
             MAX(score)::int       AS best_score,
             COUNT(*)::int         AS attempts,
             BOOL_OR(passed)       AS passed
      FROM skill_quiz_results
      WHERE user_id = ${session.userId}
      GROUP BY skill_name
    `;

    const resultMap = new Map(results.map(r => [r.skill_name as string, r]));

    const skills = skillGaps.map(gap => ({
      skill: gap.skill,
      priority: gap.priority,
      reason: gap.reason ?? '',
      passed: (resultMap.get(gap.skill)?.passed as boolean) ?? false,
      bestScore: (resultMap.get(gap.skill)?.best_score as number | null) ?? null,
      attempts: Number(resultMap.get(gap.skill)?.attempts ?? 0),
    }));

    return Response.json({ data: skills, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
