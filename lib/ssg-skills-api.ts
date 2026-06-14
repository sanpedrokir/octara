import { getAccessToken } from './ssg-api-auth';
import { httpsGetJson } from './https-request';

const SSG_BASE = 'https://public-api.ssg-wsg.sg';

export interface SsgApiResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown> | null;
  error?: string;
}

export async function ssgGetDiag(path: string): Promise<SsgApiResult> {
  const token = await getAccessToken('skillsFramework');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const result = await httpsGetJson(`${SSG_BASE}${path}`, headers, 15000);

  return {
    ok: result.ok,
    status: result.status,
    body: result.data as Record<string, unknown> | null,
    error: result.error,
  };
}

export interface SsgSector {
  id: string;
  name: string;
  description?: string;
}

export interface SsgJobRole {
  id: string;
  title: string;
  code?: string;
  sectorId: string;
  sectorName: string;
  track?: string;
  descriptions?: string;
  salaryMin?: number;
  salaryMax?: number;
}

interface RawJobRole {
  id: string;
  code?: string;
  title: string;
  sector?: { id: string; title: string; code?: string };
  track?: string;
  descriptions?: string;
  salary?: { minimum?: string; maximum?: string };
}

// Keywords that reliably return diverse Singapore job roles via SSG search.
// The SSG API ignores pageSize/pageNo; keyword search is the only way to get varied results.
const SSG_JOB_KEYWORDS = [
  'engineer','analyst','manager','officer','specialist','coordinator','director','executive',
  'consultant','technician','supervisor','assistant','associate','lead','senior',
  // Healthcare / Social
  'nurse','doctor','therapist','pharmacist','clinical','social worker','counsellor',
  // Finance / Legal
  'accountant','auditor','underwriter','claims','actuary','solicitor','counsel','paralegal',
  // Tech / ICT
  'developer','software','network','cyber','data scientist','systems administrator',
  // Hospitality / Food
  'chef','cook','kitchen','bartender','barista','catering','concierge','housekeeping',
  // Transport / Logistics
  'pilot','train','captain','logistics','warehouse','freight','supply chain',
  // Education / Training
  'teacher','educator','lecturer','trainer','childcare','preschool','instructor',
  // Environment / Landscape
  'landscape','horticulture','arborist','pest control','environmental',
  // Manufacturing / Engineering
  'machinist','toolmaker','precision','production operator','quality control','bioprocess',
  // Design / Media / Arts
  'designer','copywriter','journalist','cameraman','artist',
  // Security
  'security officer','investigator','forensic',
  // Human Resources
  'recruiter','HR',
  // Retail / Wholesale
  'merchandiser','buyer','retail',
  // Insurance
  'insurance',
  // Aerospace / Marine
  'aviation','maritime','seafarer','aerospace',
];

// Primary function: fetches sectors from facets + job roles via keyword search.
// The SSG jobRoles endpoint returns up to 8 roles without filter; keyword search
// returns different role sets — this gives the broadest coverage possible.
export async function fetchAllSsgJobRoles(): Promise<{
  sectors: SsgSector[];
  jobRoles: SsgJobRole[];
  total: number;
}> {
  const token = await getAccessToken('skillsFramework');
  if (!token) return { sectors: [], jobRoles: [], total: 0 };

  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };

  // First request — gets total count and sector facets
  const firstUrl = `${SSG_BASE}/skillsFramework/jobRoles?pageNo=0&pageSize=8`;
  const first = await httpsGetJson(firstUrl, headers, 20000);
  if (!first.ok || !first.data) return { sectors: [], jobRoles: [], total: 0 };

  const outerData = first.data as Record<string, unknown>;
  const meta = outerData.meta as Record<string, unknown> | undefined;
  const total = parseInt(String(meta?.total ?? '0'), 10);
  const innerData = outerData.data as Record<string, unknown> | undefined;

  // Extract sectors from the "Sector" facet
  const sectorMap = new Map<string, SsgSector>();
  const facets = innerData?.facets as Array<{
    label: string;
    facets: Array<{ value: string; label: string }>;
  }> | undefined;

  const sectorFacet = facets?.find(f => f.label === 'Sector');
  if (sectorFacet?.facets) {
    for (const s of sectorFacet.facets) {
      sectorMap.set(s.value, { id: s.value, name: s.label });
    }
  }

  // Collect job roles — use the role ID as dedup key
  const roleMap = new Map<string, SsgJobRole>();

  // Include roles from the first (unfilterd) response
  const firstPageRoles = innerData?.jobRoles as RawJobRole[] | undefined;
  if (firstPageRoles) {
    const tmp: SsgJobRole[] = [];
    extractRoles(firstPageRoles, tmp, sectorMap);
    for (const r of tmp) roleMap.set(r.id, r);
  }

  // Run keyword searches in parallel batches of 20
  const BATCH = 20;
  for (let i = 0; i < SSG_JOB_KEYWORDS.length; i += BATCH) {
    const batch = SSG_JOB_KEYWORDS.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(kw =>
        httpsGetJson(
          `${SSG_BASE}/skillsFramework/jobRoles?keyword=${encodeURIComponent(kw)}`,
          headers,
          15000
        )
      )
    );
    for (const res of results) {
      if (!res.ok || !res.data) continue;
      const d = (res.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
      const roles = d?.jobRoles as RawJobRole[] | undefined;
      if (!roles) continue;
      const tmp: SsgJobRole[] = [];
      extractRoles(roles, tmp, sectorMap);
      for (const r of tmp) roleMap.set(r.id, r);
    }
  }

  return { sectors: Array.from(sectorMap.values()), jobRoles: Array.from(roleMap.values()), total };
}

function extractRoles(raw: RawJobRole[], out: SsgJobRole[], sectorMap: Map<string, SsgSector>): void {
  for (const r of raw) {
    if (!r.id || !r.title) continue;
    const sectorId = r.sector?.id ?? '';
    const sectorTitle = r.sector?.title ?? '';

    if (sectorId && !sectorMap.has(sectorId)) {
      sectorMap.set(sectorId, { id: sectorId, name: sectorTitle });
    }

    out.push({
      id: r.id,
      code: r.code,
      title: r.title,
      sectorId,
      sectorName: sectorTitle,
      track: r.track ?? undefined,
      descriptions: r.descriptions?.slice(0, 500) ?? undefined,
      salaryMin: r.salary?.minimum ? parseFloat(r.salary.minimum) : undefined,
      salaryMax: r.salary?.maximum ? parseFloat(r.salary.maximum) : undefined,
    });
  }
}

// Legacy aliases for existing callers
export async function fetchSsgSubSectors(): Promise<SsgSector[]> {
  const { sectors } = await fetchAllSsgJobRoles();
  return sectors;
}

export async function fetchSsgOccupations(): Promise<Array<{ id: string; name: string; subsectorId: string }>> {
  return [];
}

export async function fetchSsgJobRoleTitles(): Promise<SsgJobRole[]> {
  const { jobRoles } = await fetchAllSsgJobRoles();
  return jobRoles;
}

export async function fetchJobRolesByOccupation(_occupationId: string): Promise<SsgJobRole[]> {
  return [];
}
