import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { searchCoursesWithSource } from '@/lib/ssg-api';
import type { SsgCourse } from '@/lib/types';

// Strip seniority/generic words and map to skill-based search terms SkillsFuture actually indexes
const STRIP_WORDS = /\b(senior|junior|associate|assistant|chief|head|lead|officer|manager|director|executive|specialist|consultant|analyst|coordinator|administrator|intern|trainee|professional)\b/gi;

const INDUSTRY_SKILL_KEYWORDS: Record<string, string[]> = {
  legal: ['legal research', 'contract law', 'compliance', 'legal writing'],
  finance: ['financial analysis', 'investment', 'risk management', 'financial modelling'],
  accounting: ['accounting', 'audit', 'taxation', 'financial reporting'],
  'information & communications technology': ['software development', 'cybersecurity', 'cloud computing', 'data analytics'],
  'information and communications technology': ['software development', 'cybersecurity', 'cloud computing', 'data analytics'],
  healthcare: ['healthcare management', 'clinical', 'nursing', 'patient care'],
  'human resources': ['human resources', 'talent management', 'recruitment', 'learning development'],
  marketing: ['digital marketing', 'marketing analytics', 'content marketing', 'brand management'],
  logistics: ['supply chain', 'logistics management', 'warehouse management', 'procurement'],
  hospitality: ['hospitality management', 'customer service', 'food beverage', 'hotel operations'],
  education: ['teaching', 'curriculum design', 'instructional design', 'adult learning'],
  'arts and entertainment': ['arts management', 'creative writing', 'media production', 'event management'],
  retail: ['retail management', 'e-commerce', 'customer experience', 'merchandising'],
  engineering: ['engineering management', 'project management', 'quality management', 'safety management'],
  construction: ['construction management', 'project management', 'building information modelling', 'quantity surveying'],
  'energy and chemicals': ['energy management', 'chemical engineering', 'sustainability', 'environmental management'],
  insurance: ['insurance', 'underwriting', 'claims management', 'risk assessment'],
};

function deriveSearchKeywords(jobRoleName: string, industryName: string): string[] {
  // 1. Try the core role words (strip seniority titles)
  const coreRole = jobRoleName.replace(STRIP_WORDS, '').replace(/\s+/g, ' ').trim();

  // 2. Try industry-level keywords as fallback
  const industryKey = Object.keys(INDUSTRY_SKILL_KEYWORDS).find(k =>
    industryName.toLowerCase().includes(k) || k.includes(industryName.toLowerCase().split(' ')[0])
  );
  const industryKws = industryKey ? INDUSTRY_SKILL_KEYWORDS[industryKey] : [];

  // Merge core role + industry keywords, deduplicate case-insensitively
  const base = coreRole && coreRole !== jobRoleName ? [coreRole] : [];
  const merged = [...base, ...industryKws];
  const seen = new Set<string>();
  const unique = merged.filter(kw => {
    const key = kw.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, 4).length > 0 ? unique.slice(0, 4) : [jobRoleName];
}

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();

    // Fetch user's career aspiration — resolve from both job_roles (seeded) and job_role_catalog (SSG)
    const rows = await sql`
      SELECT
        COALESCE(i.name,  jrc.sector)   AS industry_name,
        COALESCE(jr.name, jrc.job_role) AS job_role_name,
        jr.skill_keywords
      FROM career_aspirations ca
      LEFT JOIN industries      i   ON ca.industry_id         = i.id
      LEFT JOIN job_roles       jr  ON ca.job_role_id         = jr.id
      LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
      WHERE ca.user_id = ${session.userId}
      ORDER BY ca.created_at DESC
      LIMIT 1
    `;

    if (!rows.length) {
      return Response.json({ data: null, error: 'No career goal set' }, { status: 404 });
    }

    const { industry_name, job_role_name, skill_keywords } = rows[0] as {
      industry_name: string | null;
      job_role_name: string | null;
      skill_keywords: string[] | null;
    };

    if (!job_role_name && !industry_name) {
      return Response.json({ data: null, error: 'No career goal set' }, { status: 404 });
    }

    // Prefer TSC/CCS skill titles from job_role_tsc_ccs for more targeted keywords
    let keywords: string[] = [];
    if (job_role_name) {
      const tscRows = await sql`
        SELECT DISTINCT skill_title
        FROM job_role_tsc_ccs
        WHERE LOWER(TRIM(job_role)) = LOWER(TRIM(${job_role_name}))
        ORDER BY skill_title
        LIMIT 6
      ` as Array<{ skill_title: string }>;
      keywords = tscRows.map(r => r.skill_title).slice(0, 4);
    }

    // Fall back to job_roles.skill_keywords or derive from role/industry name
    if (keywords.length === 0) {
      keywords = Array.isArray(skill_keywords) && skill_keywords.length > 0
        ? skill_keywords.slice(0, 4)
        : deriveSearchKeywords(job_role_name ?? '', industry_name ?? '');
    }

    // Search SSG for top 4 skill keywords in parallel
    const results = await Promise.all(
      keywords.map(kw => searchCoursesWithSource(kw))
    );

    // Determine overall source
    const source = results.some(r => r.source === 'live')
      ? 'live'
      : results.some(r => r.source === 'catalog')
      ? 'catalog'
      : 'mock';

    // Deduplicate by referenceNumber, take up to 6
    const seen = new Set<string>();
    const courses: SsgCourse[] = [];
    for (const { courses: batch } of results) {
      for (const c of batch) {
        const key = c.referenceNumber || c.title;
        if (!seen.has(key) && courses.length < 6) {
          seen.add(key);
          courses.push(c);
        }
      }
    }

    return Response.json({
      data: { courses, industry_name, job_role_name, source },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load recommendations';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
