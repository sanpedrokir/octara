import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export const maxDuration = 30;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface McfJob {
  salary?: { minimum?: number; maximum?: number };
  minimumYearsExperience?: number;
}

interface McfResponse {
  total?: number;
  results?: McfJob[];
}

async function fetchMcfSalaries(role: string, sector: string) {
  const query = sector ? `${role} ${sector}` : role;
  const url = `https://api.mycareersfuture.gov.sg/v2/jobs?search=${encodeURIComponent(query)}&limit=20`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; OctaraBot/1.0)',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as McfResponse;
    return (data.results ?? [])
      .filter(j => j.salary?.minimum && j.salary?.maximum)
      .map(j => ({
        min: j.salary!.minimum!,
        max: j.salary!.maximum!,
        expYears: j.minimumYearsExperience ?? null,
      }));
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();

    const [career] = await sql`
      SELECT COALESCE(jr.name, jrc.job_role, ej.occupation_title) AS role,
             COALESCE(i.name, jrc.sector, ej.isco_group) AS sector
      FROM career_aspirations ca
      LEFT JOIN industries i ON ca.industry_id = i.id
      LEFT JOIN job_roles jr ON ca.job_role_id = jr.id
      LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
      LEFT JOIN esco_job_catalog ej ON ca.esco_occupation_id = ej.id
      WHERE ca.user_id = ${session.userId}
    ` as Array<{ role: string | null; sector: string | null }>;

    if (!career?.role && !career?.sector) {
      return Response.json({ data: null, error: 'NO_CAREER_GOAL' });
    }

    const role   = career.role   || career.sector || '';
    const sector = career.sector || '';

    // ── Step 1: fetch real salary data from MCF ──────────────────────────────
    const mcfSalaries = await fetchMcfSalaries(role, sector);
    const hasMcfData  = mcfSalaries.length >= 3;

    // ── Step 2: build GPT prompt — grounded in real data when available ──────
    let mcfContext = '';
    if (hasMcfData) {
      const lines = mcfSalaries.map(s => {
        const exp = s.expYears !== null ? ` (min ${s.expYears} yrs exp required)` : '';
        return `S$${s.min}–S$${s.max}/mo${exp}`;
      }).join('\n');
      mcfContext = `
REAL SALARY DATA from ${mcfSalaries.length} live MyCareersFuture job listings for "${role}"${sector ? ` in ${sector}` : ''}:
${lines}

You MUST use these actual figures as the basis for the salary bands. Structure them into Entry/Mid/Senior bands using the experience years where provided, or by salary level (lower = entry, higher = senior) where not. Do not invent numbers outside this range.
`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: hasMcfData
            ? 'You are a Singapore compensation expert. Structure the provided REAL MCF salary data into experience bands. Return ONLY valid JSON.'
            : 'You are a Singapore compensation expert with deep knowledge of local salary data. Use realistic Singapore market rates. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: `${mcfContext}
Provide Singapore salary benchmarks for: ${role}${sector ? ` (${sector} sector)` : ''}

Return JSON (all salary values are MONTHLY SGD):
{
  "role": "${role}",
  "sector": "${sector}",
  "currency": "SGD",
  "bands": [
    { "level": "Entry (0–3 yrs)", "min": <monthly int>, "max": <monthly int>, "typical": <monthly int>, "description": "what this level looks like" },
    { "level": "Mid (3–7 yrs)",   "min": <monthly int>, "max": <monthly int>, "typical": <monthly int>, "description": "what this level looks like" },
    { "level": "Senior (7+ yrs)", "min": <monthly int>, "max": <monthly int>, "typical": <monthly int>, "description": "what this level looks like" }
  ],
  "top_paying_factors": ["factor 1", "factor 2", "factor 3"],
  "in_demand_skills": ["skill 1", "skill 2", "skill 3", "skill 4"],
  "market_outlook": "1-2 sentence outlook for this role in Singapore"
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: hasMcfData ? 0.1 : 0.2,
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}') as Record<string, unknown>;
    result.data_source    = hasMcfData ? 'mcf' : 'gpt';
    result.listing_count  = mcfSalaries.length;

    return Response.json({ data: result, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch salary data';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
