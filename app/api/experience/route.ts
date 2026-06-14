import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();
    const rows = await sql`SELECT * FROM work_experience WHERE user_id = ${session.userId} ORDER BY is_current DESC, start_date DESC NULLS LAST`;
    return Response.json({ data: rows, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch experience';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { company, title, start_date, end_date, is_current, description } = await request.json();
    if (!company || !title) return Response.json({ data: null, error: 'Company and title are required' }, { status: 400 });

    const sql = db();
    const [row] = await sql`
      INSERT INTO work_experience (user_id, company, title, start_date, end_date, is_current, description)
      VALUES (${session.userId}, ${company}, ${title}, ${start_date || null}, ${end_date || null}, ${is_current || false}, ${description || null})
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to add experience';
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
    await sql`DELETE FROM work_experience WHERE id = ${id} AND user_id = ${session.userId}`;
    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete experience';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
