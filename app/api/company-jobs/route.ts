import { requireAuth } from '@/lib/auth';

export const maxDuration = 15;

interface McfJob {
  uuid: string;
  title?: string;
  metadata?: {
    newPostingDate?: string;
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

export interface JobEntry {
  uuid: string;
  title: string;
  company: string;
  salaryMin: number | null;
  salaryMax: number | null;
  expYears: number | null;
  postedDate: string | null;
  empType: string | null;
  posLevel: string | null;
  views: number | null;
  url: string;
}

export interface CompanyGroup {
  company: string;
  jobs: JobEntry[];
}

// For company mode: keep a job only if the company name plausibly matches the query.
// Handles abbreviations: "govtech" → matches "GOVernment TECHnology Agency"
// by checking the first 3 chars of the query against the start of each word in the company name.
function companyMatchesQuery(companyName: string, query: string): boolean {
  const cn = companyName.toLowerCase();
  const q  = query.toLowerCase().trim();
  if (q.length < 2) return true;
  if (cn.includes(q)) return true;
  const prefix = q.slice(0, 3);
  const words  = cn.split(/[\s&,.()/\\]+/).filter(Boolean);
  return words.some(w => w.startsWith(prefix));
}

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') ?? '').trim().toLowerCase();
    const mode   = (searchParams.get('mode') ?? 'company') as 'company' | 'role';
    const page   = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
    // Fetch more when in company mode to compensate for post-filter reduction
    const limit  = mode === 'company' && search ? 50 : 30;

    const mcfUrl = `https://api.mycareersfuture.gov.sg/v2/jobs?${search ? `search=${encodeURIComponent(search)}&` : ''}limit=${limit}&page=${page}&sortBy=new_posting_date`;

    const res = await fetch(mcfUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; OctaraBot/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return Response.json({ data: null, error: 'Failed to fetch listings.' }, { status: 502 });
    }

    const raw   = await res.json() as McfResponse;
    const total = raw.total ?? 0;

    const jobs: JobEntry[] = (raw.results ?? []).map(j => ({
      uuid:      j.uuid,
      title:     j.title ?? 'Untitled',
      company:   j.postedCompany?.name ?? 'Unknown Company',
      salaryMin: j.salary?.minimum ?? null,
      salaryMax: j.salary?.maximum ?? null,
      expYears:  j.minimumYearsExperience ?? null,
      postedDate: j.metadata?.newPostingDate ?? null,
      empType:   j.employmentTypes?.[0]?.employmentType ?? null,
      posLevel:  j.positionLevels?.[0]?.position ?? null,
      views:     j.metadata?.totalNumberOfView ?? null,
      url:       j.metadata?.jobDetailsUrl ?? `https://www.mycareersfuture.gov.sg/job/${j.uuid}`,
    }));

    // In company mode, filter to jobs whose company name matches the query.
    // This removes jobs from unrelated companies whose descriptions merely mention the query term.
    const filtered = (mode === 'company' && search)
      ? jobs.filter(j => companyMatchesQuery(j.company, search))
      : jobs;

    // Group by company, sorted A–Z
    const map = new Map<string, JobEntry[]>();
    for (const j of filtered) {
      const list = map.get(j.company) ?? [];
      list.push(j);
      map.set(j.company, list);
    }

    const grouped: CompanyGroup[] = Array.from(map.entries())
      .map(([company, jobs]) => ({ company, jobs }))
      .sort((a, b) => a.company.localeCompare(b.company));

    return Response.json({ data: { grouped, total, page, search, mode }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch jobs';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
