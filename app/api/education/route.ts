import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();
    const rows = await sql`SELECT * FROM education WHERE user_id = ${session.userId} ORDER BY start_year DESC NULLS LAST`;
    return Response.json({ data: rows, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch education';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { institution, degree, field_of_study, start_year, end_year, is_current } = await request.json();
    if (!institution) return Response.json({ data: null, error: 'Institution is required' }, { status: 400 });

    const sql = db();
    const [row] = await sql`
      INSERT INTO education (user_id, institution, degree, field_of_study, start_year, end_year, is_current)
      VALUES (${session.userId}, ${institution}, ${degree || null}, ${field_of_study || null}, ${start_year || null}, ${end_year || null}, ${is_current || false})
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to add education';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ data: null, error: 'ID required' }, { status: 400 });

    const sql = db();
    await sql`DELETE FROM education WHERE id = ${id} AND user_id = ${session.userId}`;
    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete education';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
