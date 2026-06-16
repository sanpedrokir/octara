import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'admin') {
    return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sector = searchParams.get('sector') || '';
  const q = searchParams.get('q') || '';
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
  const offset = Number(searchParams.get('offset')) || 0;

  const sql = db();

  const rows = await sql`
    SELECT id, skill_code, skill_title, skill_desc, skill_proficiency_level, proficiency_level_desc,
           previous_skill_title, previous_sfs_status, previous_casl_status, previous_skill_type,
           updated_skill_title, updated_skill_sfs_status, updated_casl_status, updated_skill_type, updated_sector_tagging
    FROM jobs_skills_mapping
    WHERE (${sector} = '' OR updated_sector_tagging = ${sector})
      AND (${q} = '' OR skill_title ILIKE ${'%' + q + '%'} OR skill_code ILIKE ${'%' + q + '%'})
    ORDER BY updated_sector_tagging, skill_title
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM jobs_skills_mapping
    WHERE (${sector} = '' OR updated_sector_tagging = ${sector})
      AND (${q} = '' OR skill_title ILIKE ${'%' + q + '%'} OR skill_code ILIKE ${'%' + q + '%'})
  `;

  const sectors = await sql`
    SELECT DISTINCT updated_sector_tagging AS sector FROM jobs_skills_mapping
    WHERE updated_sector_tagging IS NOT NULL
    ORDER BY updated_sector_tagging
  `;

  const [lastUpload] = await sql`
    SELECT filename, row_count, skipped_count, created_at
    FROM jobs_skills_mapping_uploads
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return Response.json({
    data: {
      rows,
      total: count,
      sectors: sectors.map(s => s.sector),
      lastUpload: lastUpload ?? null,
    },
    error: null,
  });
}
