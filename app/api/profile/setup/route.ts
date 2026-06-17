import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return Response.json({ data: null, error: 'Authentication required' }, { status: 401 });
    }

    const { bio, userType, institution, program, company, sector, jobRole, yearsExperience } = await request.json();

    if (!userType || !['student', 'working_adult', 'other'].includes(userType)) {
      return Response.json({ data: null, error: 'Please select a valid user type' }, { status: 400 });
    }

    if (userType === 'student') {
      if (!institution || !program) {
        return Response.json({ data: null, error: 'Institution and program are required' }, { status: 400 });
      }
    } else {
      if (!company || !sector || !jobRole) {
        return Response.json({ data: null, error: 'Company, sector and job role are required' }, { status: 400 });
      }
    }

    const sql = db();

    // Ensure columns exist (safe to run repeatedly)
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_sector TEXT`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_job_role TEXT`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS years_experience INT`;

    await sql`
      UPDATE profiles
      SET bio             = ${bio ?? null},
          user_type       = ${userType},
          company_name    = ${company ?? null},
          current_sector  = ${sector ?? null},
          current_job_role = ${jobRole ?? null},
          years_experience = ${yearsExperience ?? null}
      WHERE user_id = ${session.userId}
    `;

    if (userType === 'student') {
      // Remove duplicate onboarding entry before re-inserting
      await sql`
        DELETE FROM education
        WHERE user_id = ${session.userId}
          AND degree = ${program}
          AND institution = ${institution}
      `;
      await sql`
        INSERT INTO education (user_id, institution, degree, is_current)
        VALUES (${session.userId}, ${institution}, ${program}, true)
      `;
    }

    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save profile';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
