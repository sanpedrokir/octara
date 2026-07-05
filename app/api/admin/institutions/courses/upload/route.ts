import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export const maxDuration = 30;

// Expected CSV columns (case-insensitive):
// title, description, url, duration, cost, skills_covered
// skills_covered = semicolon-separated list of skill names

function parseSkills(raw: string): string[] {
  return raw.split(';').map(s => s.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const institutionId = Number(formData.get('institution_id'));
    const file = formData.get('file') as File | null;
    const replaceAll = formData.get('replace_all') === 'true';

    if (!institutionId || !file) {
      return Response.json({ data: null, error: 'institution_id and file are required' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return Response.json({ data: null, error: 'CSV must have a header row and at least one data row' }, { status: 400 });

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const col = (name: string) => headers.indexOf(name);

    const titleIdx       = col('title');
    const descIdx        = col('description');
    const urlIdx         = col('url');
    const durationIdx    = col('duration');
    const costIdx        = col('cost');
    const skillsIdx      = col('skills_covered');

    if (titleIdx === -1) return Response.json({ data: null, error: 'CSV must have a "title" column' }, { status: 400 });

    interface CourseRow {
      institution_id: number;
      title: string;
      description: string | null;
      url: string | null;
      duration: string | null;
      cost: string | null;
      skills_covered: string[];
    }

    const rows: CourseRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const title = titleIdx >= 0 ? cells[titleIdx] : '';
      if (!title) continue;
      rows.push({
        institution_id: institutionId,
        title,
        description: descIdx >= 0 ? cells[descIdx] || null : null,
        url:          urlIdx >= 0  ? cells[urlIdx]  || null : null,
        duration:     durationIdx >= 0 ? cells[durationIdx] || null : null,
        cost:         costIdx >= 0     ? cells[costIdx]     || null : null,
        skills_covered: skillsIdx >= 0 ? parseSkills(cells[skillsIdx] ?? '') : [],
      });
    }

    if (rows.length === 0) return Response.json({ data: null, error: 'No valid rows found in CSV' }, { status: 400 });

    const sql = db();

    if (replaceAll) {
      await sql`DELETE FROM institution_courses WHERE institution_id = ${institutionId}`;
    }

    let inserted = 0;
    for (const r of rows) {
      await sql`
        INSERT INTO institution_courses (institution_id, title, description, url, duration, cost, skills_covered)
        VALUES (${r.institution_id}, ${r.title}, ${r.description}, ${r.url}, ${r.duration}, ${r.cost}, ${r.skills_covered})
      `;
      inserted++;
    }

    return Response.json({ data: { inserted, total: rows.length }, error: null });
  } catch (err) {
    return Response.json({ data: null, error: err instanceof Error ? err.message : 'Upload failed' }, { status: 500 });
  }
}
