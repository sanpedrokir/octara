import { requireAuth } from '@/lib/auth';
import { generateQuizQuestions } from '@/lib/openai-client';

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { skill } = await request.json();
    if (!skill) return Response.json({ data: null, error: 'Skill is required' }, { status: 400 });

    const questions = await generateQuizQuestions(skill as string);
    return Response.json({ data: questions, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
