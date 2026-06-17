import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();

    // Ensure new columns exist
    await Promise.all([
      sql`ALTER TABLE skill_assessments ADD COLUMN IF NOT EXISTS current_skills JSONB`,
      sql`ALTER TABLE learning_roadmaps ADD COLUMN IF NOT EXISTS courses_by_skill JSONB`,
    ]);

    const [assessment] = await sql`
      SELECT id, current_job_title, current_skills, target_role, target_industry,
             skill_gaps, strengths, summary, created_at
      FROM skill_assessments
      WHERE user_id = ${session.userId}
      ORDER BY created_at DESC LIMIT 1
    `;

    const [roadmap] = await sql`
      SELECT id, roadmap_data, skill_gaps, courses_by_skill, created_at
      FROM learning_roadmaps
      WHERE user_id = ${session.userId}
      ORDER BY created_at DESC LIMIT 1
    `;

    // No data at all
    if (!assessment && !roadmap) {
      return Response.json({ data: null, error: null });
    }

    // Fallback: roadmap exists but no skill_assessments record yet
    // (user ran analysis before the save-to-DB code was added)
    if (!assessment && roadmap) {
      const [career] = await sql`
        SELECT COALESCE(jr.name, jrc.job_role) AS job_role_name,
               COALESCE(i.name, jrc.sector)    AS industry_name
        FROM career_aspirations ca
        LEFT JOIN job_roles jr ON ca.job_role_id = jr.id
        LEFT JOIN industries i ON ca.industry_id = i.id
        LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
        WHERE ca.user_id = ${session.userId}
        LIMIT 1
      `;
      return Response.json({
        data: {
          assessment: {
            currentRole: '',
            currentSkills: [],
            targetRole: career?.job_role_name ?? '',
            targetIndustry: career?.industry_name ?? '',
            skillGaps: roadmap.skill_gaps ?? [],
            strengths: [],
            summary: '',
            createdAt: roadmap.created_at,
          },
          roadmap: {
            ...(roadmap.roadmap_data as object),
            coursesBySkill: (roadmap.courses_by_skill as object) ?? {},
            createdAt: roadmap.created_at,
          },
        },
        error: null,
      });
    }

    // Normal path: assessment exists
    return Response.json({
      data: {
        assessment: {
          currentRole: assessment.current_job_title ?? '',
          currentSkills: assessment.current_skills ?? [],
          targetRole: assessment.target_role ?? '',
          targetIndustry: assessment.target_industry ?? '',
          skillGaps: assessment.skill_gaps ?? [],
          strengths: assessment.strengths ?? [],
          summary: assessment.summary ?? '',
          createdAt: assessment.created_at,
        },
        roadmap: roadmap
          ? {
              ...(roadmap.roadmap_data as object),
              coursesBySkill: (roadmap.courses_by_skill as object) ?? {},
              createdAt: roadmap.created_at,
            }
          : null,
      },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
