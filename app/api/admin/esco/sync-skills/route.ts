import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

type SkillEntry   = { title: string; uri?: string | null; skill_type?: string | null };
type MappingEntry = { occupation_title: string; isco_group: string; skills: SkillEntry[] };

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as { mappings: MappingEntry[]; clearFirst?: boolean };
    const { mappings = [], clearFirst = false } = body;

    const pool   = getPool();
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS esco_skills_mapping (
          id               SERIAL PRIMARY KEY,
          isco_group       TEXT NOT NULL,
          occupation_title TEXT NOT NULL,
          skill_title      TEXT NOT NULL,
          skill_type       TEXT,
          esco_skill_uri   TEXT,
          created_at       TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await client.query('BEGIN');
      if (clearFirst) await client.query('TRUNCATE esco_skills_mapping RESTART IDENTITY');

      const isco_groups:  (string | null)[] = [];
      const occ_titles:   string[]           = [];
      const skill_titles: string[]           = [];
      const skill_types:  (string | null)[]  = [];
      const skill_uris:   (string | null)[]  = [];

      for (const m of mappings) {
        for (const s of m.skills) {
          isco_groups.push(m.isco_group);
          occ_titles.push(m.occupation_title);
          skill_titles.push(s.title);
          skill_types.push(s.skill_type ?? null);
          skill_uris.push(s.uri ?? null);
        }
      }

      if (skill_titles.length > 0) {
        await client.query(
          `INSERT INTO esco_skills_mapping (isco_group, occupation_title, skill_title, skill_type, esco_skill_uri)
           SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])`,
          [isco_groups, occ_titles, skill_titles, skill_types, skill_uris]
        );
      }

      await client.query('COMMIT');
      return Response.json({ data: { inserted: skill_titles.length }, error: null });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
