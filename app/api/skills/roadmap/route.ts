import { requireAuth } from '@/lib/auth';
import { generateRoadmap } from '@/lib/openai-client';
import { db } from '@/lib/db';
import type { SkillGap, SsgCourse } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { skillGaps, coursesBySkill, targetRole, targetIndustry } = await request.json();

    if (!skillGaps || !targetRole || !targetIndustry) {
      return Response.json({ data: null, error: 'Skill gaps, target role and industry are required' }, { status: 400 });
    }

    const roadmap = await generateRoadmap(
      skillGaps as SkillGap[],
      coursesBySkill as Record<string, SsgCourse[]>,
      targetRole,
      targetIndustry
    );

    const sql = db();
    await sql`ALTER TABLE learning_roadmaps ADD COLUMN IF NOT EXISTS courses_by_skill JSONB`;
    const [saved] = await sql`
      INSERT INTO learning_roadmaps (user_id, roadmap_data, skill_gaps, courses_by_skill)
      VALUES (${session.userId}, ${JSON.stringify(roadmap)}, ${JSON.stringify(skillGaps)}, ${JSON.stringify(coursesBySkill || {})})
      RETURNING id, created_at
    `;

    return Response.json({ data: { ...roadmap, id: saved.id, created_at: saved.created_at }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Roadmap generation failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function GET() {
  try {
    const session = await requireAuth();
    const sql = db();
    const rows = await sql`
      SELECT * FROM learning_roadmaps WHERE user_id = ${session.userId} ORDER BY created_at DESC LIMIT 5
    `;
    return Response.json({ data: rows, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch roadmaps';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
