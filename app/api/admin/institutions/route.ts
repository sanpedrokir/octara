import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }
    const sql = db();
    const rows = await sql`
      SELECT i.id, i.name, i.slug, i.logo_url, i.is_active, i.created_at,
             COUNT(ic.id)::int AS course_count
      FROM institutions i
      LEFT JOIN institution_courses ic ON ic.institution_id = i.id AND ic.is_active = true
      GROUP BY i.id
      ORDER BY i.name
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
    if (!id) return Response.json({ data: null, error: 'id is required' }, { status: 400 });

    const sql = db();
    await sql`DELETE FROM institutions WHERE id = ${id}`;
    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    return Response.json({ data: null, error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }
    const { id, name } = await request.json() as { id: number; name: string };
    if (!id || !name?.trim()) return Response.json({ data: null, error: 'id and name are required' }, { status: 400 });

    const sql = db();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const rows = await sql`
      UPDATE institutions SET name = ${name.trim()}, slug = ${slug}
      WHERE id = ${id}
      RETURNING id, name, slug
    `;
    if (!rows.length) return Response.json({ data: null, error: 'Institution not found' }, { status: 404 });
    return Response.json({ data: rows[0], error: null });
  } catch (err) {
    return Response.json({ data: null, error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }
    const { name, slug, logo_url } = await request.json() as { name: string; slug?: string; logo_url?: string };
    if (!name?.trim()) return Response.json({ data: null, error: 'Name is required' }, { status: 400 });

    const sql = db();
    const slugValue = slug?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const rows = await sql`
      INSERT INTO institutions (name, slug, logo_url)
      VALUES (${name.trim()}, ${slugValue}, ${logo_url ?? null})
      ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug, logo_url = EXCLUDED.logo_url
      RETURNING id, name, slug, logo_url, is_active, created_at
    `;
    return Response.json({ data: rows[0], error: null });
  } catch (err) {
    return Response.json({ data: null, error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
