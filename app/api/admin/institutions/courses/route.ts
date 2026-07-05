import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const institutionId = searchParams.get('institution_id');
    if (!institutionId) return Response.json({ data: null, error: 'institution_id required' }, { status: 400 });

    const sql = db();
    const rows = await sql`
      SELECT id, institution_id, title, description, url, duration, cost, skills_covered, is_active, created_at
      FROM institution_courses
      WHERE institution_id = ${Number(institutionId)}
      ORDER BY title
    `;
    return Response.json({ data: rows, error: null });
  } catch (err) {
    return Response.json({ data: null, error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }
    const { id } = await request.json() as { id: number };
    const sql = db();
    await sql`DELETE FROM institution_courses WHERE id = ${id}`;
    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    return Response.json({ data: null, error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
