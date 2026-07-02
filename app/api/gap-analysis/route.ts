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

function scoreToProficiency(score: number): string {
  if (score >= 5) return 'expert';
  if (score >= 4) return 'advanced';
  if (score >= 3) return 'intermediate';
  return 'basic';
}

type RequiredSkill = { skill_title: string; skill_code: string | null; skill_type: string | null; required_level: string | null };

const STOP_WORDS = new Set(['and', 'or', 'the', 'of', 'in', 'for', 'a', 'an', 'to', 'with', '&']);

function tokenize(s: string): string[] {
  return s.toLowerCase()
    .split(/[\s/\-&,()]+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function isFuzzyMatch(userTitle: string, requiredTitle: string): boolean {
  const userTokens = tokenize(userTitle);
  const reqTokens  = tokenize(requiredTitle);
  if (userTokens.length === 0 || reqTokens.length === 0) return false;
  // All tokens of the shorter title must appear in the longer title's token set.
  // This catches "Agile" ⊂ "Agile Software Development" and
  // "Cloud Computing" ⊂ "Cloud Computing Architecture".
  const [shorter, longerSet] = userTokens.length <= reqTokens.length
    ? [userTokens, new Set(reqTokens)]
    : [reqTokens,  new Set(userTokens)];
  return shorter.every(t => longerSet.has(t));
}

function buildRows(
  requiredSkills: RequiredSkill[],
  userSkills: Array<{ skill_title: string; proficiency_level: string; ssg_matched: boolean; source: string }>,
  assessments: Array<{ skill_title: string; score: number }>,
  completedCourses: Array<{ skill_name: string }>,
) {
  const userSkillMap  = new Map(userSkills.map(s => [s.skill_title.toLowerCase(), s]));
  const assessMap     = new Map(assessments.map(a => [a.skill_title.toLowerCase(), a.score]));
  const completedSet  = new Set(completedCourses.map(c => c.skill_name.toLowerCase()));

  return requiredSkills.map(req => {
    const key = req.skill_title.toLowerCase();

    // 1. Exact match
    let userSkill = userSkillMap.get(key);
    let fuzzyMatchedVia: string | null = null;

    // 2. Fuzzy match — only when no exact match found
    if (!userSkill) {
      for (const s of userSkills) {
        if (isFuzzyMatch(s.skill_title, req.skill_title)) {
          userSkill = s;
          fuzzyMatchedVia = s.skill_title;
          break;
        }
      }
    }

    const score        = assessMap.get(key) ?? null;
    const courseEarned = completedSet.has(key);
    const noKnowledge  = score === 1;
    const selfRated    = score !== null && score >= 2;
    const matched      = !noKnowledge && !!(userSkill || courseEarned || selfRated);

    let status: 'strong' | 'partial' | 'course_earned' | 'missing';
    if (!matched) {
      status = 'missing';
    } else if (courseEarned && !userSkill && !selfRated) {
      status = 'course_earned';
    } else if (!fuzzyMatchedVia && score !== null && score >= 3) {
      // Fuzzy matches cap at partial — we're less certain about the skill level
      status = 'strong';
    } else {
      status = 'partial';
    }

    const derivedProficiency = !userSkill && selfRated && score !== null
      ? scoreToProficiency(score)
      : null;

    return {
      skill_title:           req.skill_title,
      skill_code:            req.skill_code,
      required_level:        req.required_level,
      user_proficiency:      userSkill?.proficiency_level ?? derivedProficiency,
      source:                userSkill?.source ?? (courseEarned ? 'course' : selfRated ? 'self_assessment' : null),
      ssg_matched:           userSkill?.ssg_matched ?? false,
      self_assessment_score: score,
      matched,
      status,
      fuzzy_matched_via:     fuzzyMatchedVia,
    };
  });
}

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();
    await ensureAssessTable();

    const [career] = await sql`
      SELECT ca.*,
             COALESCE(i.name, jrc.sector, ej.isco_group)          AS sector_name,
             COALESCE(jr.name, jrc.job_role, ej.occupation_title)  AS role_name,
             ej.esco_uri                                            AS esco_uri
      FROM career_aspirations ca
      LEFT JOIN industries       i   ON ca.industry_id        = i.id
      LEFT JOIN job_roles        jr  ON ca.job_role_id        = jr.id
      LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
      LEFT JOIN esco_job_catalog ej  ON ca.esco_occupation_id = ej.id
      WHERE ca.user_id = ${session.userId}
    ` as Array<{
      sector_name: string | null;
      role_name:   string | null;
      esco_occupation_id: number | null;
      esco_uri:    string | null;
    }>;

    if (!career) {
      return Response.json({ data: null, error: 'NO_CAREER_GOAL' }, { status: 404 });
    }

    const sectorName = career.sector_name ?? '';
    const roleName   = career.role_name   ?? '';
    const isEsco     = !!career.esco_occupation_id && !!career.esco_uri;

    // Shared: fetch user competencies, assessments, completed courses
    const [rawSkills, rawAssess, rawCourses] = await Promise.all([
      sql`SELECT skill_title, proficiency_level, ssg_matched, source FROM user_competencies WHERE user_id = ${session.userId}`,
      sql`SELECT skill_title, score FROM competency_assessments WHERE user_id = ${session.userId}`,
      sql`SELECT skill_name FROM tracked_courses WHERE user_id = ${session.userId} AND status = 'completed' AND skill_name IS NOT NULL`,
    ]);
    const userSkills      = rawSkills   as Array<{ skill_title: string; proficiency_level: string; ssg_matched: boolean; source: string }>;
    const assessments     = rawAssess   as Array<{ skill_title: string; score: number }>;
    const completedCourses = rawCourses as Array<{ skill_name: string }>;

    if (userSkills.length === 0) {
      return Response.json({ data: null, error: 'NO_COMPETENCY_PROFILE' }, { status: 404 });
    }

    // ── ESCO path (non-SG users) ────────────────────────────────────────────
    if (isEsco) {
      type EscoSkillRef = { preferredLabel: string; uri: string };
      let essentialSkills: EscoSkillRef[] = [];

      const apiUrl = `https://ec.europa.eu/esco/api/resource/occupation?uri=${encodeURIComponent(career.esco_uri!)}&language=en`;
      const escoRes = await fetch(apiUrl, { cache: 'no-store' });

      if (escoRes.ok) {
        const json = await escoRes.json() as { hasEssentialSkill?: EscoSkillRef[] };
        essentialSkills = json.hasEssentialSkill ?? [];
      }

      const requiredSkills: RequiredSkill[] = essentialSkills.map(s => ({
        skill_title:    s.preferredLabel,
        skill_code:     null,
        skill_type:     null,
        required_level: null,
      }));

      const rows = buildRows(requiredSkills, userSkills, assessments, completedCourses);

      return Response.json({
        data: {
          career:   { sector: sectorName, role: roleName },
          required: rows,
          is_esco:  true,
          summary: {
            total:         rows.length,
            matched:       rows.filter(r => r.matched).length,
            missing:       rows.filter(r => !r.matched).length,
            strong:        rows.filter(r => r.status === 'strong').length,
            course_earned: rows.filter(r => r.status === 'course_earned').length,
          },
        },
        error: null,
      });
    }

    // ── SSG path (SG users) ────────────────────────────────────────────────
    let resolvedSector = sectorName;

    if (!resolvedSector) {
      const profRows = await sql`SELECT current_sector FROM profiles WHERE user_id = ${session.userId}` as Array<{ current_sector: string | null }>;
      resolvedSector = profRows[0]?.current_sector ?? '';
    }

    if (!resolvedSector) {
      return Response.json({ data: null, error: 'NO_SECTOR' }, { status: 404 });
    }

    let requiredSkills = await sql`
      SELECT DISTINCT ON (LOWER(TRIM(skill_title)))
        skill_title, skill_code, skill_type, proficiency_level AS required_level
      FROM job_role_tsc_ccs
      WHERE LOWER(TRIM(job_role)) = LOWER(TRIM(${roleName}))
        AND (sector = ${resolvedSector} OR sector = 'Unknown' OR sector IS NULL)
      ORDER BY LOWER(TRIM(skill_title)), skill_type, id
    ` as RequiredSkill[];

    if (requiredSkills.length === 0) {
      const firstWord = resolvedSector.split(/[\s&,]/)[0]?.trim() ?? resolvedSector;
      requiredSkills = await sql`
        SELECT DISTINCT ON (COALESCE(updated_skill_title, skill_title))
          COALESCE(updated_skill_title, skill_title) AS skill_title,
          skill_code, updated_skill_type AS skill_type,
          skill_proficiency_level AS required_level
        FROM jobs_skills_mapping
        WHERE updated_sector_tagging ILIKE ${'%' + resolvedSector + '%'}
           OR updated_sector_tagging ILIKE ${'%' + firstWord + '%'}
        ORDER BY COALESCE(updated_skill_title, skill_title) ASC,
                 skill_proficiency_level DESC NULLS LAST
        LIMIT 100
      ` as RequiredSkill[];
    }

    const rows = buildRows(requiredSkills, userSkills, assessments, completedCourses);

    return Response.json({
      data: {
        career:   { sector: resolvedSector, role: roleName },
        required: rows,
        is_esco:  false,
        summary: {
          total:         rows.length,
          matched:       rows.filter(r => r.matched).length,
          missing:       rows.filter(r => !r.matched).length,
          strong:        rows.filter(r => r.status === 'strong').length,
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
