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

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() ?? '';
    const mode   = (searchParams.get('mode') ?? 'company') as 'company' | 'role';
    const page   = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
    const limit  = search ? 30 : 30;

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

    // Group by company, sorted A–Z
    // Trust MCF's search engine to match company aliases (e.g. "GovTech" → "GOVERNMENT TECHNOLOGY AGENCY")
    const map = new Map<string, JobEntry[]>();
    for (const j of jobs) {
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
