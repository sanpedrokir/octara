import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export const maxDuration = 30;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { jobDescription } = await request.json() as { jobDescription: string };

    if (!jobDescription?.trim() || jobDescription.trim().length < 50) {
      return Response.json({ data: null, error: 'Please paste a job description (at least 50 characters).' }, { status: 400 });
    }

    const sql = db();
    const skills = await sql`
      SELECT skill_title, proficiency_level, category, ssg_matched
      FROM user_competencies
      WHERE user_id = ${session.userId}
      ORDER BY ssg_matched DESC, skill_title ASC
    ` as Array<{ skill_title: string; proficiency_level: string; category: string | null; ssg_matched: boolean }>;

    if (skills.length === 0) {
      return Response.json({ data: null, error: 'Upload your CV in Competency Profile first so we can match your skills.' }, { status: 400 });
    }

    const skillList = skills.map(s => `${s.skill_title} (${s.proficiency_level})`).join(', ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a Singapore job match expert. Analyse how well a candidate\'s skills match a job description. Return ONLY valid JSON.' },
        {
          role: 'user',
          content: `Candidate skills: ${skillList}

Job description:
${jobDescription.slice(0, 2000)}

Return JSON:
{
  "match_score": <0-100 integer>,
  "verdict": "Strong Match / Good Match / Partial Match / Weak Match",
  "matched_skills": ["skill from candidate profile that appears in JD"],
  "missing_skills": ["skill required by JD not found in candidate profile"],
  "transferable_skills": ["candidate skill that partially applies to JD even if not exact"],
  "top_strengths": ["2-3 things that make this candidate stand out for this role"],
  "gaps_to_close": ["1-3 specific skills/experience to upskill before applying"],
  "apply_recommendation": "Should apply now / Should apply after upskilling / Not a good fit — here is why"
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    return Response.json({ data: result, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Matching failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
