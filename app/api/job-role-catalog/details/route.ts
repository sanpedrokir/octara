import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get('sector') || '';
    const track = searchParams.get('track') || '';
    const jobRole = searchParams.get('job_role') || '';

    if (!sector || !jobRole) {
      return Response.json({ data: null, error: 'sector and job_role are required' }, { status: 400 });
    }

    const sql = db();

    const cwfRows = await sql`
      SELECT critical_work_function, key_task
      FROM job_role_cwf_kt
      WHERE sector = ${sector} AND job_role = ${jobRole} AND (${track} = '' OR track = ${track} OR track IS NULL)
      ORDER BY id
    `;

    const skillRows = await sql`
      SELECT skill_title, skill_type, proficiency_level, skill_code
      FROM job_role_tsc_ccs
      WHERE sector = ${sector} AND job_role = ${jobRole} AND (${track} = '' OR track = ${track} OR track IS NULL)
      ORDER BY id
    `;

    const cwfMap = new Map<string, string[]>();
    for (const row of cwfRows) {
      const key = row.critical_work_function;
      if (!cwfMap.has(key)) cwfMap.set(key, []);
      if (row.key_task) cwfMap.get(key)!.push(row.key_task);
    }
    const cwf = Array.from(cwfMap.entries()).map(([critical_work_function, key_tasks]) => ({ critical_work_function, key_tasks }));

    const tsc = skillRows.filter(r => (r.skill_type || '').toLowerCase() === 'tsc');
    const ccs = skillRows.filter(r => (r.skill_type || '').toLowerCase() === 'ccs');

    return Response.json({ data: { cwf, tsc, ccs }, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch job role details';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
