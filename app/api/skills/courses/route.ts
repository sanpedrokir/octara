import { requireAuth } from '@/lib/auth';
import { searchCoursesBySkills } from '@/lib/ssg-api';

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { skills } = await request.json();

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return Response.json({ data: null, error: 'Skills array is required' }, { status: 400 });
    }

    const topSkills = skills.slice(0, 6);
    const coursesBySkill = await searchCoursesBySkills(topSkills);

    return Response.json({ data: coursesBySkill, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Course search failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
