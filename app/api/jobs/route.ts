import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const maxDuration = 15;

interface McfJob {
  uuid: string;
  title?: string;
  metadata?: {
    newPostingDate?: string;
    expiryDate?: string;
    totalNumberOfView?: number;
    jobDetailsUrl?: string;
  };
  postedCompany?: { name?: string };
  salary?: { minimum?: number; maximum?: number };
  minimumYearsExperience?: number;
  employmentTypes?: Array<{ employmentType?: string }>;
  positionLevels?: Array<{ position?: string }>;
}

interface McfResponse {
  total?: number;
  results?: McfJob[];
}

// Enum values accepted by MCF API v2 for the `categories` query param.
// Probed empirically — MCF returns 400 for any value not in this list.
const MCF_SECTOR_MAP: Array<[RegExp, string]> = [
  [/social.?serv/i,                    'Social Services'],
  [/infocomm|information.?tech|i\.?t\b/i, 'Information Technology'],
  [/health|pharma|medical|nursing/i,   'Healthcare / Pharmaceutical'],
  [/engineering/i,                     'Engineering'],
  [/manufacturing|production/i,        'Manufacturing'],
  [/logistic|supply.?chain|warehouse/i,'Logistics / Supply Chain'],
  [/banking|finance|financial/i,       'Banking and Finance'],
  [/insurance/i,                       'Insurance'],
  [/hospitality|tourism|hotel/i,       'Hospitality'],
  [/legal|law/i,                       'Legal'],
  [/admin|secretar/i,                  'Admin / Secretarial'],
  [/f&b|food.?&.?bev|restaurant|catering/i, 'F&B'],
  [/design|creative/i,                 'Design'],
  [/human.?res|hr\b/i,                 'Human Resources'],
  [/customer.?serv/i,                  'Customer Service'],
];

function toMcfCategory(sector: string): string | null {
  for (const [pattern, mcfValue] of MCF_SECTOR_MAP) {
    if (pattern.test(sector)) return mcfValue;
  }
  return null;
}

// Maps role keywords to MCF positionLevels enum values (array form accepted by MCF API).
const MCF_LEVEL_MAP: Array<[RegExp, string[]]> = [
  [/\b(chief|ceo|coo|cfo|cto|ciso|president|vice.?president|vp\b|executive.?director|managing.?director)\b/i,
    ['Senior Management']],
  [/\b(director|assistant.?director|deputy.?director|associate.?director|senior.?director)\b/i,
    ['Senior Management', 'Middle Management']],
  [/\b(senior.?manager|general.?manager|head\b|assistant.?vp|avp)\b/i,
    ['Senior Management', 'Middle Management']],
  [/\b(manager|supervisor|principal|lead\b)\b/i,
    ['Middle Management', 'Manager']],
  [/\b(associate|analyst|consultant|specialist|coordinator|officer|executive\b)\b/i,
    ['Professional', 'Executive']],
  [/\b(intern|trainee|fresh|junior|entry)\b/i,
    ['Fresh/Entry Level']],
];

function toMcfLevels(role: string): string[] {
  for (const [pattern, levels] of MCF_LEVEL_MAP) {
    if (pattern.test(role)) return levels;
  }
  return []; // no filter = all levels
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));

    const sql = db();
    const [career] = await sql`
      SELECT COALESCE(jr.name, jrc.job_role, ej.occupation_title) AS role,
             COALESCE(i.name, jrc.sector, ej.isco_group)          AS sector
      FROM career_aspirations ca
      LEFT JOIN industries i      ON ca.industry_id          = i.id
      LEFT JOIN job_roles jr      ON ca.job_role_id          = jr.id
      LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
      LEFT JOIN esco_job_catalog ej  ON ca.esco_occupation_id  = ej.id
      WHERE ca.user_id = ${session.userId}
    ` as Array<{ role: string | null; sector: string | null }>;

    if (!career?.role && !career?.sector) {
      return Response.json({ data: null, error: 'NO_CAREER_GOAL' });
    }

    const role   = career.role   ?? career.sector ?? '';
    const sector = career.sector ?? '';

    // Clean role: strip slash-alternatives (MCF search breaks on "/")
    const cleanRole = role.split(/\s*\/\s*/)[0].trim() || sector;

    // Map sector to MCF category enum value for precise filtering
    const mcfCategory = sector ? toMcfCategory(sector) : null;
    // Map role to seniority levels — prevents Social Workers appearing for Director goals
    const mcfLevels   = toMcfLevels(role);

    const params = new URLSearchParams({
      search: cleanRole,
      limit:  '10',
      page:   String(page),
      sortBy: 'new_posting_date',
    });
    if (mcfCategory) params.set('categories', mcfCategory);
    // MCF requires repeated param keys for arrays: positionLevels[]=X&positionLevels[]=Y
    const levelParam = mcfLevels.map(l => `positionLevels[]=${encodeURIComponent(l)}`).join('&');

    const url = `https://api.mycareersfuture.gov.sg/v2/jobs?${params}${levelParam ? '&' + levelParam : ''}`;
    const res = await fetch(url, {
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; OctaraBot/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return Response.json({ data: null, error: 'Failed to fetch job listings.' }, { status: 502 });
    }

    const raw   = await res.json() as McfResponse;
    const total = raw.total ?? 0;
    const query = cleanRole + (mcfCategory ? ` · ${mcfCategory}` : '') + (mcfLevels.length ? ` · ${mcfLevels[0]}` : '');

    const jobs = (raw.results ?? []).map(j => ({
      uuid:       j.uuid,
      title:      j.title ?? 'Untitled',
      company:    j.postedCompany?.name ?? 'Unknown Company',
      salaryMin:  j.salary?.minimum ?? null,
      salaryMax:  j.salary?.maximum ?? null,
      expYears:   j.minimumYearsExperience ?? null,
      postedDate: j.metadata?.newPostingDate ?? null,
      expiryDate: j.metadata?.expiryDate ?? null,
      empType:    j.employmentTypes?.[0]?.employmentType ?? null,
      posLevel:   j.positionLevels?.[0]?.position ?? null,
      views:      j.metadata?.totalNumberOfView ?? null,
      url:        j.metadata?.jobDetailsUrl ?? `https://www.mycareersfuture.gov.sg/job/${j.uuid}`,
    }));

    return Response.json({
      data: { jobs, total, role, sector, query, page },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch jobs';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
