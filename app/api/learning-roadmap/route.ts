import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import OpenAI from 'openai';

export const maxDuration = 30;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();

    const [[career], skills, gapRows] = await Promise.all([
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
      sql`SELECT skill_title, proficiency_level FROM user_competencies WHERE user_id = ${session.userId} ORDER BY ssg_matched DESC LIMIT 20` as Promise<Array<{ skill_title: string; proficiency_level: string }>>,
      sql`SELECT skill_title, gap_type FROM skill_gaps WHERE user_id = ${session.userId} LIMIT 15` as Promise<Array<{ skill_title: string; gap_type: string }>>,
    ]);

    if (!career) {
      return Response.json({ data: null, error: 'NO_CAREER_GOAL' }, { status: 400 });
    }

    const targetRole = career.role || career.sector || 'Professional';
    const currentSkills = skills.map(s => `${s.skill_title} (${s.proficiency_level})`).join(', ') || 'None listed';
    const gaps = gapRows.map(g => g.skill_title).join(', ') || 'None identified';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a Singapore career development expert. Create actionable, realistic 3-phase learning roadmaps. Return ONLY valid JSON.' },
        {
          role: 'user',
          content: `Create a learning roadmap for someone targeting: ${targetRole}
Current skills: ${currentSkills}
Skill gaps to close: ${gaps}

Return JSON with exactly 3 phases:
{
  "role": "${targetRole}",
  "total_duration": "e.g. 6-9 months",
  "phases": [
    {
      "phase": 1,
      "title": "Foundation",
      "duration": "e.g. 0-2 months",
      "focus": "one sentence describing this phase goal",
      "milestones": [
        { "title": "milestone name", "description": "what to achieve (1 sentence)", "type": "course | project | certification | practice" }
      ],
      "skills_targeted": ["skill1", "skill2"],
      "resources": ["specific resource name or platform"]
    },
    {
      "phase": 2,
      "title": "Build",
      "duration": "...",
      "focus": "...",
      "milestones": [...],
      "skills_targeted": [...],
      "resources": [...]
    },
    {
      "phase": 3,
      "title": "Launch",
      "duration": "...",
      "focus": "...",
      "milestones": [...],
      "skills_targeted": [...],
      "resources": [...]
    }
  ],
  "quick_wins": ["one thing to do this week to get started"],
  "success_metric": "how to know you are ready for this role (1 sentence)"
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    return Response.json({ data: result, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate roadmap';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
