import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// Bulk-matches existing students' education.institution text to the institutions table
// and writes institution_id onto their profiles row.
export async function POST() {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const sql = db();

    // Count before update so we can report how many were linked
    const before = await sql`
      SELECT COUNT(*)::int AS n FROM profiles
      WHERE user_type = 'student' AND institution_id IS NULL
    ` as Array<{ n: number }>;

    await sql`
      UPDATE profiles p
      SET institution_id = i.id
      FROM education e
      JOIN institutions i ON LOWER(i.name) = LOWER(e.institution) AND i.is_active = true
      WHERE e.user_id = p.user_id
        AND p.user_type = 'student'
        AND p.institution_id IS NULL
        AND e.is_current = true
    `;

    const after = await sql`
      SELECT COUNT(*)::int AS n FROM profiles
      WHERE user_type = 'student' AND institution_id IS NULL
    ` as Array<{ n: number }>;

    const updated = (before[0]?.n ?? 0) - (after[0]?.n ?? 0);
    return Response.json({ data: { updated }, error: null });
  } catch (err) {
    return Response.json({ data: null, error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
