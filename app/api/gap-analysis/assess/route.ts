import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS competency_assessments (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_title  TEXT NOT NULL,
      score        INTEGER NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, skill_title)
    )
  `;
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await ensureTable();

    const { skill_title, score } = await request.json() as { skill_title: string; score: number };

    if (!skill_title?.trim()) {
      return Response.json({ data: null, error: 'skill_title required' }, { status: 400 });
    }
    const s = Number(score);
    if (!s || s < 1 || s > 5) {
      return Response.json({ data: null, error: 'score must be 1-5' }, { status: 400 });
    }

    const sql = db();
    const [row] = await sql`
      INSERT INTO competency_assessments (user_id, skill_title, score)
      VALUES (${session.userId}, ${skill_title.trim()}, ${s})
      ON CONFLICT (user_id, skill_title) DO UPDATE SET
        score      = EXCLUDED.score,
        updated_at = NOW()
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Assessment save failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
