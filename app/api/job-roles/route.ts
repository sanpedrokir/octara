import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const industryId = searchParams.get('industry_id');

    const sql = db();
    const rows = industryId
      ? await sql`SELECT * FROM job_roles WHERE industry_id = ${industryId} ORDER BY name`
      : await sql`SELECT * FROM job_roles ORDER BY name`;

    return Response.json({ data: rows, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch job roles';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const { industry_id, name, description, skill_keywords } = await request.json();
    if (!industry_id || !name) {
      return Response.json({ data: null, error: 'Industry and name are required' }, { status: 400 });
    }

    const sql = db();
    const keywords = Array.isArray(skill_keywords) ? skill_keywords : [];
    const [row] = await sql`
      INSERT INTO job_roles (industry_id, name, description, skill_keywords)
      VALUES (${industry_id}, ${name}, ${description || null}, ${keywords})
      RETURNING *
    `;
    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create job role';
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
    await sql`DELETE FROM job_roles WHERE id = ${id}`;
    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete job role';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
