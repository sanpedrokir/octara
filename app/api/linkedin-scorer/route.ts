import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export const maxDuration = 30;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { profileText } = await request.json() as { profileText: string };

    if (!profileText?.trim() || profileText.trim().length < 50) {
      return Response.json({ data: null, error: 'Please paste at least 50 characters of your LinkedIn profile.' }, { status: 400 });
    }

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

    const targetRole = career?.role || career?.sector || 'your target role';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a LinkedIn profile optimisation expert for Singapore professionals. Score and give actionable rewrites. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: `Score this LinkedIn profile for someone targeting: ${targetRole}

PROFILE TEXT:
${profileText.slice(0, 3000)}

Return JSON:
{
  "overall_score": <0-100 integer>,
  "grade": "A/B/C/D/F",
  "sections": {
    "headline": { "score": <0-20>, "feedback": "...", "rewrite": "suggested headline (max 120 chars)" },
    "summary": { "score": <0-25>, "feedback": "...", "rewrite": "suggested summary (3-4 sentences)" },
    "skills": { "score": <0-20>, "feedback": "...", "missing_skills": ["skill1", "skill2", "skill3"] },
    "experience": { "score": <0-25>, "feedback": "...", "tip": "one actionable improvement" },
    "completeness": { "score": <0-10>, "feedback": "...", "missing": ["photo", "recommendations", etc] }
  },
  "top_3_actions": ["action 1", "action 2", "action 3"],
  "keywords_to_add": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    return Response.json({ data: { ...result, targetRole }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Scoring failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
