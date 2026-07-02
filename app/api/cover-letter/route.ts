import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export const maxDuration = 30;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { jobTitle, companyName, jobDescription } = await request.json() as {
      jobTitle: string; companyName: string; jobDescription: string;
    };

    if (!jobDescription?.trim() || jobDescription.trim().length < 50) {
      return Response.json({ data: null, error: 'Please paste a job description (at least 50 characters).' }, { status: 400 });
    }

    const sql = db();
    const [[user], [career], skills, experience] = await Promise.all([
      sql`SELECT name FROM users WHERE id = ${session.userId}` as Promise<Array<{ name: string }>>,
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
      sql`SELECT skill_title, proficiency_level FROM user_competencies WHERE user_id = ${session.userId} ORDER BY ssg_matched DESC LIMIT 12` as Promise<Array<{ skill_title: string; proficiency_level: string }>>,
      sql`SELECT title, company, description FROM work_experience WHERE user_id = ${session.userId} ORDER BY start_date DESC NULLS LAST LIMIT 3` as Promise<Array<{ title: string; company: string; description: string | null }>>,
    ]);

    const name = user?.name || 'Applicant';
    const targetRole = jobTitle || career?.role || career?.sector || 'the role';
    const company = companyName || 'your company';
    const skillList = skills.map(s => s.skill_title).join(', ');
    const expSummary = experience.map(e => `${e.title} at ${e.company}${e.description ? `: ${e.description.slice(0, 100)}` : ''}`).join('; ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a professional cover letter writer for Singapore job applications. Write compelling, concise letters (300-400 words). Return ONLY valid JSON.' },
        {
          role: 'user',
          content: `Write a cover letter for:
Name: ${name}
Applying for: ${targetRole} at ${company}
Key skills: ${skillList || 'Not provided'}
Work experience: ${expSummary || 'Not provided'}

Job description snippet:
${jobDescription.slice(0, 1500)}

Return JSON:
{
  "letter": "full cover letter text with proper paragraphs separated by \\n\\n",
  "subject_line": "suggested email subject line",
  "key_matches": ["skill/experience from profile that directly matches JD", "...", "..."]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    return Response.json({ data: { ...result, name, targetRole, company }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate cover letter';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
