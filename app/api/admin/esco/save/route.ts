import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

const ISCO_MAJOR: Record<string, string> = {
  '0': 'Armed Forces Occupations',
  '1': 'Managers',
  '2': 'Professionals',
  '3': 'Technicians and Associate Professionals',
  '4': 'Clerical Support Workers',
  '5': 'Service and Sales Workers',
  '6': 'Skilled Agricultural, Forestry and Fishery Workers',
  '7': 'Craft and Related Trades Workers',
  '8': 'Plant and Machine Operators and Assemblers',
  '9': 'Elementary Occupations',
};

type OccInput   = { title: string; description?: string | null; uri?: string | null; iscoCode?: string | null; iscoLabel?: string | null };
type SkillInput = { title: string; uri?: string | null };

async function ensureEscoTables(client: { query: (sql: string) => Promise<unknown> }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS esco_job_catalog (
      id SERIAL PRIMARY KEY, isco_group TEXT NOT NULL, sub_group TEXT,
      occupation_title TEXT NOT NULL, occupation_description TEXT, esco_uri TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS esco_standalone_skills (
      id SERIAL PRIMARY KEY, skill_title TEXT NOT NULL, skill_type TEXT,
      description TEXT, esco_skill_uri TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS esco_skills_mapping (
      id SERIAL PRIMARY KEY, isco_group TEXT NOT NULL, occupation_title TEXT NOT NULL,
      skill_title TEXT NOT NULL, skill_type TEXT, esco_skill_uri TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS esco_uploads (
      id SERIAL PRIMARY KEY, filename VARCHAR(255),
      occ_count INTEGER NOT NULL DEFAULT 0, skill_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as { occupations?: OccInput[]; skills?: SkillInput[] };
    const occupations: OccInput[]   = body.occupations ?? [];
    const skills:      SkillInput[] = body.skills      ?? [];

    const pool   = getPool();
    const client = await pool.connect();
    try {
      await ensureEscoTables(client as unknown as Parameters<typeof ensureEscoTables>[0]);
      await client.query('BEGIN');

      let occCount   = 0;
      let skillCount = 0;

      if (occupations.length > 0) {
        await client.query('TRUNCATE esco_job_catalog RESTART IDENTITY');
        const isco_groups: (string | null)[] = [];
        const sub_groups:  (string | null)[] = [];
        const titles:      string[]           = [];
        const descs:       (string | null)[]  = [];
        const uris:        (string | null)[]  = [];

        for (const o of occupations) {
          const majorKey  = (o.iscoCode ?? '').charAt(0);
          const iscoGroup = ISCO_MAJOR[majorKey] ?? o.iscoLabel ?? 'Other';
          isco_groups.push(iscoGroup);
          sub_groups.push(o.iscoLabel ?? null);
          titles.push(o.title || 'Unknown');
          descs.push(o.description ? String(o.description).slice(0, 1000) : null);
          uris.push(o.uri ?? null);
        }

        await client.query(
          `INSERT INTO esco_job_catalog (isco_group, sub_group, occupation_title, occupation_description, esco_uri)
           SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])`,
          [isco_groups, sub_groups, titles, descs, uris]
        );
        occCount = occupations.length;
      }

      if (skills.length > 0) {
        await client.query('TRUNCATE esco_standalone_skills RESTART IDENTITY');
        const stitles: string[]         = [];
        const suris:   (string | null)[] = [];
        for (const s of skills) {
          stitles.push(s.title || 'Unknown');
          suris.push(s.uri ?? null);
        }
        await client.query(
          `INSERT INTO esco_standalone_skills (skill_title, skill_type, esco_skill_uri)
           SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[])`,
          [stitles, stitles.map(() => 'skill'), suris]
        );
        skillCount = skills.length;
      }

      await client.query(
        `INSERT INTO esco_uploads (filename, occ_count, skill_count, skipped_count, uploaded_by)
         VALUES ($1, $2, $3, 0, $4)`,
        [`ESCO browser import`, occCount, skillCount, session.userId]
      );

      await client.query('COMMIT');

      return Response.json({
        data: {
          success: true,
          occupations: occCount,
          skills: skillCount,
          message: `Saved ${occCount} occupations and ${skillCount} skills to database.`,
        },
        error: null,
      });
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
