import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'SG'`;

    const rows = await sql`
      SELECT id, name, email, role, COALESCE(country, 'SG') AS country
      FROM users WHERE id = ${session.userId}
    `;
    if (!rows.length) return Response.json({ data: null, error: 'User not found' }, { status: 404 });

    return Response.json({ data: rows[0], error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
