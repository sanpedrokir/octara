import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { status, notes, job_url } = await request.json() as { status?: string; notes?: string; job_url?: string };
    const sql = db();

    const [row] = await sql`
      UPDATE job_applications
      SET status     = COALESCE(${status ?? null}, status),
          notes      = COALESCE(${notes ?? null}, notes),
          job_url    = COALESCE(${job_url ?? null}, job_url),
          updated_at = NOW()
      WHERE id = ${Number(id)} AND user_id = ${session.userId}
      RETURNING *
    `;
    if (!row) return Response.json({ data: null, error: 'Not found' }, { status: 404 });
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Update failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const sql = db();
    await sql`DELETE FROM job_applications WHERE id = ${Number(id)} AND user_id = ${session.userId}`;
    return Response.json({ data: { ok: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Delete failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
