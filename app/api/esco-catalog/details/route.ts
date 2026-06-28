import { requireAuth } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

type EscoSkill = { uri: string; preferredLabel: string; skillType?: string };

function skillTypeLabel(uri?: string): string {
  if (!uri) return 'skill';
  const seg = uri.split('/').pop() ?? '';
  return seg === 'knowledge' ? 'knowledge' : 'skill';
}

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const escoUri  = searchParams.get('esco_uri') ?? '';
    const jobRole  = searchParams.get('job_role') ?? '';
    const sector   = searchParams.get('sector') ?? '';

    const pool = getPool();
    const client = await pool.connect();

    let uri = escoUri;
    if (!uri && jobRole) {
      try {
        const { rows } = await client.query<{ esco_uri: string }>(
          `SELECT esco_uri FROM esco_job_catalog
           WHERE occupation_title = $1 AND ($2 = '' OR isco_group = $2)
           LIMIT 1`,
          [jobRole, sector]
        );
        uri = rows[0]?.esco_uri ?? '';
      } finally {
        client.release();
      }
    } else {
      client.release();
    }

    if (!uri) {
      return Response.json({ data: { cwf: [], tsc: [], ccs: [] }, error: null });
    }

    // Fetch occupation resource from ESCO API (single call — not rate-limited for individual lookups)
    const apiUrl = `https://ec.europa.eu/esco/api/resource/occupation?uri=${encodeURIComponent(uri)}&language=en`;
    const res = await fetch(apiUrl, { cache: 'no-store' });

    if (!res.ok) {
      return Response.json({ data: { cwf: [], tsc: [], ccs: [] }, error: null });
    }

    const json = await res.json() as {
      hasEssentialSkill?: EscoSkill[];
      hasOptionalSkill?:  EscoSkill[];
    };

    const tsc = (json.hasEssentialSkill ?? []).map(s => ({
      skill_title:       s.preferredLabel,
      skill_type:        skillTypeLabel(s.skillType),
      proficiency_level: null,
      skill_code:        null,
    }));

    const ccs = (json.hasOptionalSkill ?? []).map(s => ({
      skill_title:       s.preferredLabel,
      skill_type:        skillTypeLabel(s.skillType),
      proficiency_level: null,
      skill_code:        null,
    }));

    return Response.json({ data: { cwf: [], tsc, ccs }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
