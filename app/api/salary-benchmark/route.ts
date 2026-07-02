import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export const maxDuration = 30;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const role = career.role || career.sector || '';
    const sector = career.sector || '';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a Singapore compensation expert with deep knowledge of local salary data. Use realistic Singapore market rates. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: `Provide Singapore salary benchmarks for: ${role}${sector ? ` (${sector} sector)` : ''}

Return JSON:
{
  "role": "${role}",
  "sector": "${sector}",
  "currency": "SGD",
  "bands": [
    { "level": "Entry (0-3 yrs)", "min": <int>, "max": <int>, "typical": <int>, "description": "what this level looks like" },
    { "level": "Mid (3-7 yrs)", "min": <int>, "max": <int>, "typical": <int>, "description": "what this level looks like" },
    { "level": "Senior (7+ yrs)", "min": <int>, "max": <int>, "typical": <int>, "description": "what this level looks like" }
  ],
  "top_paying_factors": ["factor 1", "factor 2", "factor 3"],
  "in_demand_skills": ["skill 1", "skill 2", "skill 3", "skill 4"],
  "market_outlook": "1-2 sentence outlook for this role in Singapore",
  "data_note": "These are AI-estimated ranges based on Singapore market knowledge as of 2024-2025. Actual salaries vary by company size, skills, and negotiation."
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    return Response.json({ data: result, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch salary data';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
