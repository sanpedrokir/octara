import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const sql = db();
    const rows = await sql`SELECT * FROM industries ORDER BY name`;
    return Response.json({ data: rows, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch industries';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const { name, description } = await request.json();
    if (!name) return Response.json({ data: null, error: 'Name is required' }, { status: 400 });

    const sql = db();
    const [row] = await sql`
      INSERT INTO industries (name, description)
      VALUES (${name}, ${description || null})
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create industry';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ data: null, error: 'ID required' }, { status: 400 });

    const sql = db();
    await sql`DELETE FROM industries WHERE id = ${id}`;
    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete industry';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
