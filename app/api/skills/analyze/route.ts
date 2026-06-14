import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { analyzeSkillGaps } from '@/lib/openai-client';

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { currentRole, currentSkills, targetRole, targetIndustry, yearsExperience, resumeText } = await request.json();

    if (!targetRole || !targetIndustry) {
      return Response.json({ data: null, error: 'Target role and industry are required' }, { status: 400 });
    }

    const sql = db();

    // Ensure new columns exist (safe to run repeatedly)
    await sql`ALTER TABLE skill_assessments ADD COLUMN IF NOT EXISTS current_skills JSONB`;

    const eduRows = await sql`
      SELECT degree, institution FROM education
      WHERE user_id = ${session.userId}
      ORDER BY is_current DESC, id DESC LIMIT 1
    `;
    const studyProgram = eduRows[0]
      ? `${eduRows[0].degree || ''}${eduRows[0].institution ? ` at ${eduRows[0].institution}` : ''}`.trim()
      : '';

    const result = await analyzeSkillGaps(
      currentRole || 'Student',
      currentSkills || [],
      targetRole,
      targetIndustry,
      yearsExperience || 0,
      resumeText,
      studyProgram
    );

    // Save to DB so Skills Navigator can restore it on next visit
    await sql`
      INSERT INTO skill_assessments
        (user_id, assessment_type, current_job_title, current_skills, target_role, target_industry, skill_gaps, strengths, summary, ai_model_used)
      VALUES
        (${session.userId}, 'ai', ${currentRole || ''}, ${JSON.stringify(currentSkills || [])},
         ${targetRole}, ${targetIndustry}, ${JSON.stringify(result.skill_gaps)},
         ${JSON.stringify(result.current_strengths)}, ${result.summary}, 'gpt-4o-mini')
    `;

    return Response.json({ data: result, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
