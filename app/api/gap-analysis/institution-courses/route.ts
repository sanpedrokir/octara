import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

// Returns institution courses matched to the user's skill gaps.
// Only works for students who have an institution_id set on their profile.
export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ data: null, error: 'Not authenticated' }, { status: 401 });

    const { missingSkills } = await request.json() as { missingSkills: string[] };
    if (!missingSkills?.length) {
      return Response.json({ data: { courses: [], institutionName: null }, error: null });
    }

    const sql = db();

    // Get user's institution_id + user_type from their profile
    const profileRows = await sql`
      SELECT p.institution_id, p.user_type, i.name AS institution_name
      FROM profiles p
      LEFT JOIN institutions i ON i.id = p.institution_id
      WHERE p.user_id = ${session.userId}
      LIMIT 1
    `;
    const profile = profileRows[0] as { institution_id: number | null; user_type: string | null; institution_name: string | null } | undefined;

    if (!profile?.institution_id) {
      return Response.json({ data: { courses: [], institutionName: null }, error: null });
    }

    // Fetch all active courses for this institution
    const allCourses = await sql`
      SELECT id, title, description, url, duration, cost, skills_covered
      FROM institution_courses
      WHERE institution_id = ${profile.institution_id} AND is_active = true
      ORDER BY title
    `;

    if (!allCourses.length) {
      return Response.json({ data: { courses: [], institutionName: profile.institution_name }, error: null });
    }

    // Build a normalised set of missing skill words for matching
    const STOP_WORDS = new Set([
      'and','the','of','in','to','for','a','an','across','through','with','by',
      'at','from','on','as','its','or','is','are','be','been','into','via',
      'per','up','out','over','under','about','that','this','these','those',
    ]);

    function keywordsOf(text: string): string[] {
      return text.toLowerCase()
        .split(/[\s\-\/,.()+&]+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w));
    }

    const gapKeywords = new Set(missingSkills.flatMap(keywordsOf));

    // A course matches if its skills_covered array or title share at least one keyword with the gaps
    type CourseRow = {
      id: number;
      title: string;
      description: string | null;
      url: string | null;
      duration: string | null;
      cost: string | null;
      skills_covered: string[];
    };

    const matched = (allCourses as CourseRow[]).filter(c => {
      const courseWords = new Set([
        ...keywordsOf(c.title),
        ...c.skills_covered.flatMap(keywordsOf),
      ]);
      for (const w of courseWords) if (gapKeywords.has(w)) return true;
      return false;
    });

    // Sort matched first, then return up to 20
    const courses = matched.slice(0, 20).map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      url: c.url,
      duration: c.duration,
      cost: c.cost,
      skills_covered: c.skills_covered,
      provider: profile.institution_name ?? 'Your Institution',
      type: 'institution' as const,
    }));

    return Response.json({ data: { courses, institutionName: profile.institution_name }, error: null });
  } catch (err) {
    return Response.json({ data: null, error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
