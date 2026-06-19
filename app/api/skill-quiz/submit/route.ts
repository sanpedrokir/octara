import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { skill, score, total } = await request.json() as { skill: string; score: number; total: number };

    if (!skill || score === undefined || !total) {
      return Response.json({ data: null, error: 'Invalid input' }, { status: 400 });
    }

    const passed = score / total >= 0.8;
    const sql = db();

    const [row] = await sql`
      INSERT INTO skill_quiz_results (user_id, skill_name, score, total, passed)
      VALUES (${session.userId}, ${skill}, ${score}, ${total}, ${passed})
      RETURNING *
    `;

    return Response.json({ data: row, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    return Response.json({ data: null, error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
