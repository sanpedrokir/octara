import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const maxDuration = 15;

interface McfJob {
  uuid: string;
  metadata?: {
    jobTitle?: string;
    newPostingDate?: string;
    expiryDate?: string;
    totalNumberOfView?: number;
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
    const query  = sector ? `${role} ${sector}` : role;

    const url = `https://api.mycareersfuture.gov.sg/v2/jobs?search=${encodeURIComponent(query)}&limit=10&page=${page}&sortBy=new_posting_date`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; OctaraBot/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return Response.json({ data: null, error: 'Failed to fetch job listings.' }, { status: 502 });
    }

    const raw = await res.json() as McfResponse;
    const total = raw.total ?? 0;

    const jobs = (raw.results ?? []).map(j => ({
      uuid:        j.uuid,
      title:       j.metadata?.jobTitle ?? 'Untitled',
      company:     j.postedCompany?.name ?? 'Unknown Company',
      salaryMin:   j.salary?.minimum ?? null,
      salaryMax:   j.salary?.maximum ?? null,
      expYears:    j.minimumYearsExperience ?? null,
      postedDate:  j.metadata?.newPostingDate ?? null,
      expiryDate:  j.metadata?.expiryDate ?? null,
      empType:     j.employmentTypes?.[0]?.employmentType ?? null,
      posLevel:    j.positionLevels?.[0]?.position ?? null,
      views:       j.metadata?.totalNumberOfView ?? null,
      url:         `https://www.mycareersfuture.gov.sg/job/${j.uuid}`,
    }));

    return Response.json({
      data: { jobs, total, role, sector, page },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch jobs';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
