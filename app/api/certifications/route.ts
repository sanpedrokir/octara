import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

async function ensureTable(sql: ReturnType<typeof import('@/lib/db').db>) {
  await sql`
    CREATE TABLE IF NOT EXISTS user_certifications (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL,
      category      TEXT    NOT NULL CHECK (category IN ('certification', 'training')),
      title         TEXT    NOT NULL,
      organisation  TEXT,
      date_obtained DATE,
      expiry_date   DATE,
      notes         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();
    await ensureTable(sql);

    const rows = await sql`
      SELECT * FROM user_certifications
      WHERE user_id = ${session.userId}
      ORDER BY date_obtained DESC NULLS LAST, created_at DESC
    `;
    return Response.json({ data: rows, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { category, title, organisation, date_obtained, expiry_date, notes } =
      await request.json() as {
        category: string;
        title: string;
        organisation?: string;
        date_obtained?: string;
        expiry_date?: string;
        notes?: string;
      };

    if (!category || !title?.trim()) {
      return Response.json({ data: null, error: 'Category and title are required' }, { status: 400 });
    }

    const sql = db();
    await ensureTable(sql);

    const [row] = await sql`
      INSERT INTO user_certifications
        (user_id, category, title, organisation, date_obtained, expiry_date, notes)
      VALUES
        (${session.userId}, ${category}, ${title.trim()},
         ${organisation?.trim() || null},
         ${date_obtained || null},
         ${expiry_date || null},
         ${notes?.trim() || null})
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ data: null, error: 'id required' }, { status: 400 });

    const sql = db();
    await sql`
      DELETE FROM user_certifications
      WHERE id = ${Number(id)} AND user_id = ${session.userId}
    `;
    return Response.json({ data: { id }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
