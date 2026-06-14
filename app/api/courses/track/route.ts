import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { course_reference_number, course_title, provider_name, course_url, fee, skill_name } = await request.json();

    if (!course_title) {
      return Response.json({ data: null, error: 'Course title is required' }, { status: 400 });
    }

    const sql = db();
    const [row] = await sql`
      INSERT INTO tracked_courses (user_id, course_reference_number, course_title, provider_name, course_url, fee, skill_name, status)
      VALUES (${session.userId}, ${course_reference_number || null}, ${course_title}, ${provider_name || null}, ${course_url || null}, ${fee || null}, ${skill_name || null}, 'in_progress')
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to track course';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const { id, status } = await request.json();
    if (!id || !status) return Response.json({ data: null, error: 'ID and status required' }, { status: 400 });

    const sql = db();
    const [row] = await sql`
      UPDATE tracked_courses
      SET status = ${status}, completed_at = ${status === 'completed' ? new Date().toISOString() : null}
      WHERE id = ${id} AND user_id = ${session.userId}
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update course';
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
    await sql`DELETE FROM tracked_courses WHERE id = ${id} AND user_id = ${session.userId}`;
    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to remove course';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
