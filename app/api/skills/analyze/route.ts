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

    // Fetch user's study program / education for richer AI context
    const sql = db();
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

    return Response.json({ data: result, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
