import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export const maxDuration = 30;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST() {
  try {
    const session = await requireAuth();
    const sql = db();

    const [[user], [career], skills, education, experience] = await Promise.all([
      sql`SELECT name FROM users WHERE id = ${session.userId}` as Promise<Array<{ name: string }>>,
      sql`
        SELECT COALESCE(i.name, jrc.sector, ej.isco_group) AS sector,
               COALESCE(jr.name, jrc.job_role, ej.occupation_title) AS role
        FROM career_aspirations ca
        LEFT JOIN industries i ON ca.industry_id = i.id
        LEFT JOIN job_roles jr ON ca.job_role_id = jr.id
        LEFT JOIN job_role_catalog jrc ON ca.catalog_job_role_id = jrc.id
        LEFT JOIN esco_job_catalog ej ON ca.esco_occupation_id = ej.id
        WHERE ca.user_id = ${session.userId}
      ` as Promise<Array<{ sector: string | null; role: string | null }>>,
      sql`SELECT skill_title, proficiency_level, category FROM user_competencies WHERE user_id = ${session.userId} ORDER BY ssg_matched DESC, skill_title ASC` as Promise<Array<{ skill_title: string; proficiency_level: string; category: string | null }>>,
      sql`SELECT institution, degree, field_of_study, start_year, end_year, is_current FROM education WHERE user_id = ${session.userId} ORDER BY start_year DESC NULLS LAST` as Promise<Array<{ institution: string; degree: string | null; field_of_study: string | null; start_year: number | null; end_year: number | null; is_current: boolean }>>,
      sql`SELECT title, company, start_date, end_date, is_current, description FROM work_experience WHERE user_id = ${session.userId} ORDER BY start_date DESC NULLS LAST` as Promise<Array<{ title: string; company: string; start_date: string | null; end_date: string | null; is_current: boolean; description: string | null }>>,
    ]);

    const careerGoal = career?.role || career?.sector || 'Professional';
    const userName = user?.name || 'Candidate';

    const skillLines = skills.slice(0, 25).map(s => `${s.skill_title} (${s.proficiency_level})`).join(', ');
    const eduLines = education.map(e => `${e.institution}: ${[e.degree, e.field_of_study].filter(Boolean).join(', ')} (${e.start_year ?? ''}${e.end_year ? `–${e.end_year}` : e.is_current ? '–Present' : ''})`).join('\n') || 'Not provided';
    const expLines = experience.map(e => {
      const period = e.start_date ? `${new Date(e.start_date).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })} – ${e.end_date ? new Date(e.end_date).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' }) : 'Present'}` : '';
      return `${e.title} at ${e.company}${period ? ` (${period})` : ''}${e.description ? `: ${e.description}` : ''}`;
    }).join('\n') || 'Not provided';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Singapore career resume writer. Generate compelling, ATS-optimised resume content. Return ONLY valid JSON, no markdown.',
        },
        {
          role: 'user',
          content: `Generate resume content for ${userName} targeting: ${careerGoal}

SKILLS: ${skillLines || 'Not provided'}

EDUCATION:
${eduLines}

EXPERIENCE:
${expLines}

Return JSON:
{
  "summary": "3-sentence professional summary for ${careerGoal} role, Singapore context",
  "technical_skills": ["up to 10 top technical skills from the list"],
  "soft_skills": ["up to 6 soft skills"],
  "experience_bullets": [
    { "title": "job title", "company": "company", "period": "date range", "bullets": ["achievement 1", "achievement 2", "achievement 3"] }
  ],
  "education_lines": [
    { "institution": "...", "qualification": "degree + field", "period": "..." }
  ],
  "keywords": ["10 ATS keywords for ${careerGoal}"]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    return Response.json({ data: { ...result, name: userName, careerGoal }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate resume';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
