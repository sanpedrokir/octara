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

    // Include career sector for quiz auto-detection
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
