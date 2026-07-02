import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

async function ensureTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS job_applications (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company      TEXT NOT NULL,
      role         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'applied',
      applied_date DATE,
      job_url      TEXT,
      notes        TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET() {
  try {
    const session = await requireAuth();
    await ensureTable();
    const sql = db();
    const rows = await sql`
      SELECT id, company, role, status, applied_date, job_url, notes, created_at
      FROM job_applications
      WHERE user_id = ${session.userId}
      ORDER BY created_at DESC
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
    const { company, role, status, applied_date, job_url, notes } = await request.json() as {
      company: string; role: string; status: string;
      applied_date: string | null; job_url: string | null; notes: string | null;
    };

    if (!company?.trim() || !role?.trim()) {
      return Response.json({ data: null, error: 'Company and role are required' }, { status: 400 });
    }

    const sql = db();
    const [row] = await sql`
      INSERT INTO job_applications (user_id, company, role, status, applied_date, job_url, notes)
      VALUES (${session.userId}, ${company.trim()}, ${role.trim()}, ${status || 'applied'}, ${applied_date || null}, ${job_url || null}, ${notes || null})
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to add application';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
