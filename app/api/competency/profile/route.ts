import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS user_competencies (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_title      TEXT NOT NULL,
      skill_code       TEXT,
      proficiency_level TEXT NOT NULL DEFAULT 'intermediate',
      category         TEXT,
      source           TEXT NOT NULL DEFAULT 'manual',
      ssg_matched      BOOLEAN NOT NULL DEFAULT false,
      ssg_sector       TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, skill_title)
    )
  `;
}

export async function GET() {
  try {
    const session = await requireAuth();
    await ensureTable();
    const sql = db();
    const rows = await sql`
      SELECT id, skill_title, skill_code, proficiency_level, category, source, ssg_matched, ssg_sector, created_at
      FROM user_competencies
      WHERE user_id = ${session.userId}
      ORDER BY ssg_matched DESC, skill_title ASC
    `;
    return Response.json({ data: rows, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await ensureTable();
    const sql = db();

    const body = await request.json() as {
      skill_title: string;
      skill_code?: string;
      proficiency_level?: string;
      category?: string;
      source?: string;
      ssg_matched?: boolean;
      ssg_sector?: string;
    };

    if (!body.skill_title?.trim()) {
      return Response.json({ data: null, error: 'Skill title is required' }, { status: 400 });
    }

    const proficiency = ['basic', 'intermediate', 'advanced', 'expert'].includes(body.proficiency_level ?? '')
      ? body.proficiency_level!
      : 'intermediate';

    const [row] = await sql`
      INSERT INTO user_competencies
        (user_id, skill_title, skill_code, proficiency_level, category, source, ssg_matched, ssg_sector)
      VALUES
        (${session.userId}, ${body.skill_title.trim()}, ${body.skill_code ?? null},
         ${proficiency}, ${body.category ?? null}, ${body.source ?? 'manual'},
         ${body.ssg_matched ?? false}, ${body.ssg_sector ?? null})
      ON CONFLICT (user_id, skill_title) DO UPDATE SET
        proficiency_level = EXCLUDED.proficiency_level,
        skill_code        = COALESCE(EXCLUDED.skill_code, user_competencies.skill_code),
        ssg_matched       = EXCLUDED.ssg_matched OR user_competencies.ssg_matched,
        ssg_sector        = COALESCE(EXCLUDED.ssg_sector, user_competencies.ssg_sector)
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id  = searchParams.get('id');
    const all = searchParams.get('all');

    await ensureTable();
    const sql = db();

    if (all === 'true') {
      await sql`DELETE FROM user_competencies WHERE user_id = ${session.userId}`;
    } else {
      if (!id) return Response.json({ data: null, error: 'id required' }, { status: 400 });
      await sql`DELETE FROM user_competencies WHERE id = ${Number(id)} AND user_id = ${session.userId}`;
    }
    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
