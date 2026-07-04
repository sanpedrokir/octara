import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CACHE_TTL_DAYS = 7;

interface McfJob {
  title?: string;
  description?: string;
  requirements?: string;
  company?: { name?: string };
  skills?: Array<{ skill?: string }>;
}

interface McfResponse {
  total?: number;
  results?: McfJob[];
}

async function ensureCacheTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS market_skills_cache (
      id               SERIAL PRIMARY KEY,
      job_role         TEXT NOT NULL UNIQUE,
      skills           JSONB NOT NULL DEFAULT '[]',
      job_count        INTEGER NOT NULL DEFAULT 0,
      total_listings   INTEGER NOT NULL DEFAULT 0,
      sample_companies JSONB NOT NULL DEFAULT '[]',
      fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    const { jobTitle, sector = '' } = await request.json() as { jobTitle: string; sector?: string };
    if (!jobTitle?.trim()) {
      return Response.json({ data: null, error: 'Job title is required' }, { status: 400 });
    }

    // Cache key combines role + sector so "Assistant Director (Finance)" ≠ "Assistant Director (Social Work)"
    const cacheKey = sector.trim() ? `${jobTitle.trim()}:${sector.trim()}` : jobTitle.trim();

    const sql = db();
    await ensureCacheTable();

    // 1. Return cached result if fresh (< CACHE_TTL_DAYS old)
    const cached = await sql`
      SELECT skills, job_count, total_listings, sample_companies, fetched_at
      FROM market_skills_cache
      WHERE LOWER(TRIM(job_role)) = LOWER(TRIM(${cacheKey}))
        AND fetched_at > NOW() - INTERVAL '7 days'
    ` as Array<{
      skills: object;
      job_count: number;
      total_listings: number;
      sample_companies: object;
      fetched_at: string;
    }>;

    if (cached.length > 0) {
      return Response.json({
        data: {
          skills:          cached[0].skills,
          jobCount:        cached[0].job_count,
          totalListings:   cached[0].total_listings,
          sampleCompanies: cached[0].sample_companies,
          cached:          true,
        },
        error: null,
      });
    }

    // 2. Fetch live listings from MyCareersFuture — include sector to avoid cross-sector contamination
    const mcfQuery = sector.trim() ? `${jobTitle.trim()} ${sector.trim()}` : jobTitle.trim();
    const mcfUrl = `https://api.mycareersfuture.gov.sg/v2/jobs?search=${encodeURIComponent(mcfQuery)}&limit=10`;
    let jobs: McfJob[] = [];
    let totalListings = 0;

    try {
      const mcfRes = await fetch(mcfUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; OctaraBot/1.0)',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (mcfRes.ok) {
        const mcfData = await mcfRes.json() as McfResponse;
        jobs = mcfData.results ?? [];
        totalListings = mcfData.total ?? jobs.length;
      }
    } catch {
      // MCF unreachable
    }

    if (jobs.length === 0) {
      return Response.json({ data: null, error: `No job listings found for "${jobTitle}" on MyCareersFuture.` });
    }

    // 3. Build combined text and extract skills with AI
    const combinedText = jobs.map((job, i) =>
      [`[Job ${i + 1}] ${job.title ?? jobTitle}${job.company?.name ? ` · ${job.company.name}` : ''}`,
        job.description ?? '', job.requirements ?? '',
        (job.skills ?? []).map(s => s.skill).filter(Boolean).join(', '),
      ].filter(Boolean).join('\n')
    ).join('\n\n---\n\n').slice(0, 8000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a skill extraction expert for Singapore job market analysis.
Extract and deduplicate all required skills from job listings.
Return ONLY valid JSON — no markdown, no explanation:
{ "skills": [{ "name": "string (1–5 words)", "category": "Technical"|"Tools & Platforms"|"Soft Skills"|"Domain Knowledge", "importance": "high"|"medium"|"low", "frequency": <1–${jobs.length}> }] }
Rules: merge synonyms; frequency = listings mentioning it; importance: high=3+, medium=2, low=1; return 10–25 skills sorted by frequency desc.
IMPORTANT: Only extract skills genuinely relevant to the "${sector || jobTitle}" sector. Ignore skills from unrelated industries that may appear in mixed search results.`,
        },
        { role: 'user', content: `Job title: "${jobTitle}"${sector ? ` | Sector: "${sector}"` : ''}\n\n${combinedText}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const extracted = JSON.parse(completion.choices[0].message.content ?? '{"skills":[]}') as {
      skills: Array<{ name: string; category: string; importance: string; frequency: number }>;
    };

    const skills = extracted.skills ?? [];
    const companies = [...new Set(jobs.map(j => j.company?.name).filter((n): n is string => !!n))].slice(0, 5);

    // 4. Cache the result (keyed by role:sector to avoid cross-sector collisions)
    await sql`
      INSERT INTO market_skills_cache (job_role, skills, job_count, total_listings, sample_companies)
      VALUES (${cacheKey}, ${JSON.stringify(skills)}, ${jobs.length}, ${totalListings}, ${JSON.stringify(companies)})
      ON CONFLICT (job_role) DO UPDATE SET
        skills           = EXCLUDED.skills,
        job_count        = EXCLUDED.job_count,
        total_listings   = EXCLUDED.total_listings,
        sample_companies = EXCLUDED.sample_companies,
        fetched_at       = NOW()
    `;

    return Response.json({
      data: { skills, jobCount: jobs.length, totalListings, sampleCompanies: companies, cached: false },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch market skills';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
