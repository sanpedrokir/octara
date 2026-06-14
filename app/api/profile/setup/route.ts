import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return Response.json({ data: null, error: 'Authentication required' }, { status: 401 });
    }

    const { bio, userType, institution, program } = await request.json();

    if (!userType || !['student', 'working_adult', 'other'].includes(userType)) {
      return Response.json({ data: null, error: 'Please select a valid user type' }, { status: 400 });
    }
    if (!institution || !program) {
      return Response.json({ data: null, error: 'Institution and program are required' }, { status: 400 });
    }

    const sql = db();

    await sql`
      UPDATE profiles
      SET bio = ${bio ?? null}, user_type = ${userType}
      WHERE user_id = ${session.userId}
    `;

    // For students, mark education as current (still studying); for others, it's highest completed
    const isCurrent = userType === 'student';

    // Remove any previously saved onboarding education entry first (avoid duplicates on re-submit)
    await sql`
      DELETE FROM education
      WHERE user_id = ${session.userId}
        AND degree = ${program}
        AND institution = ${institution}
    `;

    await sql`
      INSERT INTO education (user_id, institution, degree, is_current)
      VALUES (${session.userId}, ${institution}, ${program}, ${isCurrent})
    `;

    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save profile';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
