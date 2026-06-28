import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

async function ensureUserColumns(sql: ReturnType<typeof db>) {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'SG'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_url TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_filename TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_uploaded_at TIMESTAMPTZ`;
}

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();
    await ensureUserColumns(sql);

    const rows = await sql`
      SELECT id, name, email, role,
             COALESCE(country, 'SG') AS country,
             linkedin_url, resume_filename, resume_uploaded_at
      FROM users WHERE id = ${session.userId}
    `;
    if (!rows.length) return Response.json({ data: null, error: 'User not found' }, { status: 404 });

    const careerRows = await sql`
      SELECT COALESCE(i.name, jrc.sector) AS career_sector
      FROM career_aspirations ca
      LEFT JOIN industries i ON ca.industry_id = i.id
      LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
      WHERE ca.user_id = ${session.userId}
      LIMIT 1
    ` as Array<{ career_sector: string | null }>;

    const career_sector = careerRows[0]?.career_sector ?? null;
    return Response.json({ data: { ...rows[0], career_sector }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const sql = db();
    await ensureUserColumns(sql);

    const body = await request.json() as { linkedin_url?: string };
    if (body.linkedin_url !== undefined) {
      const url = body.linkedin_url.trim();
      if (url && !url.includes('linkedin.com/in/')) {
        return Response.json({ data: null, error: 'Please enter a valid LinkedIn profile URL (linkedin.com/in/…)' }, { status: 400 });
      }
      await sql`UPDATE users SET linkedin_url = ${url || null} WHERE id = ${session.userId}`;
    }
    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
