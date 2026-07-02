import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export const maxDuration = 30;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();

    const [[career], skills] = await Promise.all([
      sql`
        SELECT COALESCE(jr.name, jrc.job_role, ej.occupation_title) AS role,
               COALESCE(i.name, jrc.sector, ej.isco_group) AS sector
        FROM career_aspirations ca
        LEFT JOIN industries i ON ca.industry_id = i.id
        LEFT JOIN job_roles jr ON ca.job_role_id = jr.id
        LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
        LEFT JOIN esco_job_catalog ej ON ca.esco_occupation_id = ej.id
        WHERE ca.user_id = ${session.userId}
      ` as Promise<Array<{ role: string | null; sector: string | null }>>,
      sql`SELECT skill_title, proficiency_level FROM user_competencies WHERE user_id = ${session.userId} ORDER BY ssg_matched DESC LIMIT 15` as Promise<Array<{ skill_title: string; proficiency_level: string }>>,
    ]);

    const targetRole = career?.role || career?.sector || 'Professional';
    const skillList = skills.map(s => `${s.skill_title} (${s.proficiency_level})`).join(', ') || 'Not provided';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert Singapore interview coach. Generate realistic, role-specific interview questions. Return ONLY valid JSON.' },
        {
          role: 'user',
          content: `Generate interview questions for: ${targetRole}
User skills: ${skillList}

Return JSON:
{
  "role": "${targetRole}",
  "questions": [
    { "id": 1, "type": "behavioral", "question": "...", "tip": "what a strong answer includes (1 sentence)" },
    { "id": 2, "type": "behavioral", "question": "...", "tip": "..." },
    { "id": 3, "type": "behavioral", "question": "...", "tip": "..." },
    { "id": 4, "type": "technical", "question": "...", "tip": "..." },
    { "id": 5, "type": "technical", "question": "...", "tip": "..." },
    { "id": 6, "type": "technical", "question": "...", "tip": "..." },
    { "id": 7, "type": "situational", "question": "...", "tip": "..." },
    { "id": 8, "type": "situational", "question": "...", "tip": "..." }
  ]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    return Response.json({ data: result, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate questions';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { question, answer, role } = await request.json() as { question: string; answer: string; role: string };

    if (!answer?.trim() || answer.trim().length < 10) {
      return Response.json({ data: null, error: 'Answer is too short.' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a Singapore interview coach giving concise, actionable feedback. Return ONLY valid JSON.' },
        {
          role: 'user',
          content: `Role: ${role}
Question: ${question}
Candidate answer: ${answer}

Return JSON:
{
  "score": <1-10 integer>,
  "grade": "Strong / Good / Needs Work / Weak",
  "strengths": ["what they did well (1-2 points)"],
  "improvements": ["what to improve (1-2 points)"],
  "model_answer_snippet": "One sentence showing the ideal opening or key point they missed",
  "star_tip": "One tip on using the STAR method for this answer"
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    return Response.json({ data: result, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Feedback failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
