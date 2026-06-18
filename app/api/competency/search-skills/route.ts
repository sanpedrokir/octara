import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim();
    const sector = (searchParams.get('sector') ?? '').trim();

    if (!q && !sector) {
      return Response.json({ data: [], error: null });
    }

    const sql = db();
    const keyword = q.replace(/[%_]/g, '');

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Search failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
