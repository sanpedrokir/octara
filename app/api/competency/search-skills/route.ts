import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim();
    const sector = (searchParams.get('sector') ?? '').trim();

    if (!q && !sector) {
      return Response.json({ data: [], error: null });
    }

    const sql = db();
    const keyword = q.replace(/[%_]/g, '');

    // Determine user's country to serve the correct skills catalog
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'SG'`;
    const [userRow] = await sql`SELECT COALESCE(country, 'SG') AS country FROM users WHERE id = ${session.userId}` as Array<{ country: string }>;
    const isSgUser = (userRow?.country ?? 'SG') === 'SG';

    if (isSgUser) {
      const rows = await sql`
        SELECT DISTINCT
          COALESCE(updated_skill_title, skill_title) AS skill_title,
          skill_code,
          updated_sector_tagging AS sector,
          skill_proficiency_level AS proficiency_level
        FROM jobs_skills_mapping
        WHERE
          (${keyword} = '' OR skill_title ILIKE ${'%' + keyword + '%'}
            OR updated_skill_title ILIKE ${'%' + keyword + '%'})
          AND (${sector} = '' OR updated_sector_tagging ILIKE ${'%' + sector + '%'})
        ORDER BY skill_title ASC
        LIMIT 30
      ` as Array<{ skill_title: string; skill_code: string | null; sector: string | null; proficiency_level: string | null }>;
      return Response.json({ data: rows, error: null });
    }

    // Non-SG users: search ESCO skills mapping
    const rows = await sql`
      SELECT DISTINCT
        skill_title,
        NULL::text AS skill_code,
        skill_type AS sector,
        NULL::text AS proficiency_level
      FROM esco_skills_mapping
      WHERE ${keyword} = '' OR skill_title ILIKE ${'%' + keyword + '%'}
      ORDER BY skill_title ASC
      LIMIT 30
    ` as Array<{ skill_title: string; skill_code: string | null; sector: string | null; proficiency_level: string | null }>;

    return Response.json({ data: rows, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Search failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
