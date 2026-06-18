import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

async function ensureAssessTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS competency_assessments (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_title  TEXT NOT NULL,
      score        INTEGER NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, skill_title)
    )
  `;
}

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();
    await ensureAssessTable();

    // Resolve career goal
    const [career] = await sql`
      SELECT ca.*,
             COALESCE(i.name, jrc.sector)   AS sector_name,
             COALESCE(jr.name, jrc.job_role) AS role_name
      FROM career_aspirations ca
      LEFT JOIN industries       i   ON ca.industry_id        = i.id
      LEFT JOIN job_roles        jr  ON ca.job_role_id        = jr.id
      LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
      WHERE ca.user_id = ${session.userId}
    ` as Array<{ sector_name: string | null; role_name: string | null }>;

    if (!career) {
      return Response.json({ data: null, error: 'NO_CAREER_GOAL' }, { status: 404 });
    }

    let sectorName = career.sector_name ?? '';
    const roleName = career.role_name ?? '';

    // Fallback: profile's current_sector
    if (!sectorName) {
      const [prof] = await sql`SELECT current_sector FROM profiles WHERE user_id = ${session.userId}` as Array<{ current_sector: string | null }>;
      sectorName = prof?.current_sector ?? '';
    }

    if (!sectorName) {
      return Response.json({ data: null, error: 'NO_SECTOR' }, { status: 404 });
    }

    // Get required competencies from SSG Skills Framework for this sector
    // DISTINCT ON skill_title so each skill appears once at the highest required level
    const firstWord = sectorName.split(/[\s&,]/)[0]?.trim() ?? sectorName;
    const requiredSkills = await sql`
      SELECT DISTINCT ON (COALESCE(updated_skill_title, skill_title))
        COALESCE(updated_skill_title, skill_title) AS skill_title,
        skill_code,
        updated_sector_tagging AS sector,
        skill_proficiency_level AS required_level
      FROM jobs_skills_mapping
      WHERE updated_sector_tagging ILIKE ${'%' + sectorName + '%'}
         OR updated_sector_tagging ILIKE ${'%' + firstWord + '%'}
      ORDER BY COALESCE(updated_skill_title, skill_title) ASC,
               skill_proficiency_level DESC NULLS LAST
      LIMIT 60
    ` as Array<{ skill_title: string; skill_code: string | null; sector: string | null; required_level: string | null }>;

    // User's saved competencies
    const userSkills = await sql`
      SELECT skill_title, proficiency_level, ssg_matched, source
      FROM user_competencies WHERE user_id = ${session.userId}
    ` as Array<{ skill_title: string; proficiency_level: string; ssg_matched: boolean; source: string }>;

    // Self-assessments
    const assessments = await sql`
      SELECT skill_title, score FROM competency_assessments WHERE user_id = ${session.userId}
    ` as Array<{ skill_title: string; score: number }>;

    // Completed courses that may have credited skills
    const completedCourses = await sql`
      SELECT skill_name FROM tracked_courses
      WHERE user_id = ${session.userId} AND status = 'completed' AND skill_name IS NOT NULL
    ` as Array<{ skill_name: string }>;

    const userSkillMap  = new Map(userSkills.map(s => [s.skill_title.toLowerCase(), s]));
    const assessMap     = new Map(assessments.map(a => [a.skill_title.toLowerCase(), a.score]));
    const completedSet  = new Set(completedCourses.map(c => c.skill_name.toLowerCase()));

    const rows = requiredSkills.map(req => {
      const key         = req.skill_title.toLowerCase();
      const userSkill   = userSkillMap.get(key);
      const score       = assessMap.get(key) ?? null;
      const courseEarned = completedSet.has(key);
      const matched     = !!(userSkill || courseEarned);

      let status: 'strong' | 'partial' | 'course_earned' | 'missing';
      if (courseEarned && !userSkill) status = 'course_earned';
      else if (matched && score !== null && score >= 3) status = 'strong';
      else if (matched) status = 'partial';
      else status = 'missing';

      return {
        skill_title:          req.skill_title,
        skill_code:           req.skill_code,
        required_level:       req.required_level,
        user_proficiency:     userSkill?.proficiency_level ?? null,
        source:               userSkill?.source ?? (courseEarned ? 'course' : null),
        ssg_matched:          userSkill?.ssg_matched ?? false,
        self_assessment_score: score,
        matched,
        status,
      };
    });

    return Response.json({
      data: {
        career: { sector: sectorName, role: roleName },
        required: rows,
        summary: {
          total:        rows.length,
          matched:      rows.filter(r => r.matched).length,
          missing:      rows.filter(r => !r.matched).length,
          strong:       rows.filter(r => r.status === 'strong').length,
          course_earned: rows.filter(r => r.status === 'course_earned').length,
        },
      },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gap analysis failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
