import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { normaliseHeader, parseXlsxSchemas, parseTabularFile } from '@/lib/file-upload-parse';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Aliases for the Occupations sheet (our template + ESCO native CSV column names)
const OCC_ALIASES: Record<string, string> = {
  iscogroup: 'isco_group',
  isco: 'isco_group',
  sector: 'isco_group',
  majorgroup: 'isco_group',
  group: 'isco_group',
  subgroup: 'sub_group',
  track: 'sub_group',
  subgrouptitle: 'sub_group',
  occupationtitle: 'occupation_title',
  jobrole: 'occupation_title',
  preferredlabel: 'occupation_title',
  occupation: 'occupation_title',
  title: 'occupation_title',
  description: 'occupation_description',
  occupationdescription: 'occupation_description',
  escoUri: 'esco_uri',
  uri: 'esco_uri',
  concepturi: 'esco_uri',
};

// Aliases for the Skills sheet
const SKILL_ALIASES: Record<string, string> = {
  occupationtitle: 'occupation_title',
  jobrole: 'occupation_title',
  occupation: 'occupation_title',
  skilltitle: 'skill_title',
  skill: 'skill_title',
  preferredlabel: 'skill_title',
  title: 'skill_title',
  skilltype: 'skill_type',
  type: 'skill_type',
  escoskilluri: 'esco_skill_uri',
  skilluri: 'esco_skill_uri',
  uri: 'esco_skill_uri',
  concepturi: 'esco_skill_uri',
};

type OccRow   = { isco_group: string; sub_group: string | null; occupation_title: string; occupation_description: string | null; esco_uri: string | null };
type SkillRow = { occupation_title: string; skill_title: string; skill_type: string | null; esco_skill_uri: string | null };

function mapOccRows(raw: Record<string, string>[]): { rows: OccRow[]; skipped: number } {
  const headers = raw.length > 0 ? Object.keys(raw[0]) : [];
  const hmap = new Map<string, string>();
  for (const h of headers) {
    const t = OCC_ALIASES[normaliseHeader(h)];
    if (t) hmap.set(h, t);
  }
  let skipped = 0;
  const rows: OccRow[] = [];
  for (const r of raw) {
    const mapped: Record<string, string | null> = {};
    for (const [src, field] of hmap) mapped[field] = String(r[src] ?? '').trim() || null;
    if (!mapped['isco_group'] || !mapped['occupation_title']) { skipped++; continue; }
    rows.push({
      isco_group:             mapped['isco_group']!,
      sub_group:              mapped['sub_group'] ?? null,
      occupation_title:       mapped['occupation_title']!,
      occupation_description: mapped['occupation_description'] ?? null,
      esco_uri:               mapped['esco_uri'] ?? null,
    });
  }
  return { rows, skipped };
}

function mapSkillRows(raw: Record<string, string>[], iscoLookup: Map<string, string>): { rows: (SkillRow & { isco_group: string })[]; skipped: number } {
  const headers = raw.length > 0 ? Object.keys(raw[0]) : [];
  const hmap = new Map<string, string>();
  for (const h of headers) {
    const t = SKILL_ALIASES[normaliseHeader(h)];
    if (t) hmap.set(h, t);
  }
  let skipped = 0;
  const rows: (SkillRow & { isco_group: string })[] = [];
  for (const r of raw) {
    const mapped: Record<string, string | null> = {};
    for (const [src, field] of hmap) mapped[field] = String(r[src] ?? '').trim() || null;
    if (!mapped['occupation_title'] || !mapped['skill_title']) { skipped++; continue; }
    const occTitle = mapped['occupation_title']!;
    const isco_group = iscoLookup.get(occTitle.toLowerCase()) ?? 'Unknown';
    rows.push({
      isco_group,
      occupation_title: occTitle,
      skill_title:      mapped['skill_title']!,
      skill_type:       mapped['skill_type'] ?? null,
      esco_skill_uri:   mapped['esco_skill_uri'] ?? null,
    });
  }
  return { rows, skipped };
}

async function ensureEscoTables(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS esco_job_catalog (
      id                    SERIAL PRIMARY KEY,
      isco_group            TEXT NOT NULL,
      sub_group             TEXT,
      occupation_title      TEXT NOT NULL,
      occupation_description TEXT,
      esco_uri              TEXT,
      created_at            TIMESTAMPTZ DEFAULT NOW()
    )
  `);
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
  await client.query(`
    CREATE TABLE IF NOT EXISTS esco_uploads (
      id            SERIAL PRIMARY KEY,
      filename      VARCHAR(255),
      occ_count     INTEGER NOT NULL DEFAULT 0,
      skill_count   INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return Response.json({ data: null, error: 'No file uploaded' }, { status: 400 });
    }

    const filename = (file as File).name || '';
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    if (!['csv', 'xlsx'].includes(ext)) {
      return Response.json({ data: null, error: 'Please upload .xlsx or .csv' }, { status: 400 });
    }

    const buffer = Buffer.from(await (file as File).arrayBuffer());

    let occRaw: Record<string, string>[] = [];
    let skillRaw: Record<string, string>[] = [];

    if (ext === 'xlsx') {
      // Multi-sheet: pick best sheet for each schema
      const parsed = await parseXlsxSchemas(buffer, { occupations: OCC_ALIASES, skills: SKILL_ALIASES });
      occRaw   = parsed.occupations.rows;
      skillRaw = parsed.skills.rows;
    } else {
      // CSV: try to detect which schema it matches better
      const parsed = await parseTabularFile(buffer, 'csv', OCC_ALIASES);
      const parsedSk = await parseTabularFile(buffer, 'csv', SKILL_ALIASES);
      // Whichever schema has more recognized columns wins
      const occScore   = parsed.sourceHeaders.filter(h => OCC_ALIASES[normaliseHeader(h)]).length;
      const skillScore = parsedSk.sourceHeaders.filter(h => SKILL_ALIASES[normaliseHeader(h)]).length;
      if (skillScore > occScore) skillRaw = parsedSk.rows;
      else occRaw = parsed.rows;
    }

    if (occRaw.length === 0 && skillRaw.length === 0) {
      return Response.json({ data: null, error: 'No data rows found. Make sure the file has an "ESCO Occupations" and/or "ESCO Skills" sheet with the correct column headers.' }, { status: 400 });
    }

    const { rows: occRows, skipped: occSkipped } = mapOccRows(occRaw);
    // Build lookup: occupation title → isco_group for skill enrichment
    const iscoLookup = new Map(occRows.map(r => [r.occupation_title.toLowerCase(), r.isco_group]));
    const { rows: skillRows, skipped: skillSkipped } = mapSkillRows(skillRaw, iscoLookup);
    const totalSkipped = occSkipped + skillSkipped;

    const pool = getPool();
    const client = await pool.connect();
    try {
      await ensureEscoTables(client as unknown as Parameters<typeof ensureEscoTables>[0]);
      await client.query('BEGIN');

      // Replace all existing data
      await client.query('TRUNCATE esco_job_catalog, esco_skills_mapping RESTART IDENTITY');

      if (occRows.length > 0) {
        const cols = ['isco_group', 'sub_group', 'occupation_title', 'occupation_description', 'esco_uri'];
        const arrays = cols.map(c => occRows.map(r => (r as Record<string, unknown>)[c] ?? null));
        const cast = cols.map((_, i) => `$${i + 1}::text[]`).join(', ');
        await client.query(
          `INSERT INTO esco_job_catalog (${cols.join(', ')}) SELECT * FROM UNNEST(${cast})`,
          arrays
        );
      }

      if (skillRows.length > 0) {
        const cols = ['isco_group', 'occupation_title', 'skill_title', 'skill_type', 'esco_skill_uri'];
        const arrays = cols.map(c => skillRows.map(r => (r as Record<string, unknown>)[c] ?? null));
        const cast = cols.map((_, i) => `$${i + 1}::text[]`).join(', ');
        await client.query(
          `INSERT INTO esco_skills_mapping (${cols.join(', ')}) SELECT * FROM UNNEST(${cast})`,
          arrays
        );
      }

      await client.query(
        `INSERT INTO esco_uploads (filename, occ_count, skill_count, skipped_count, uploaded_by) VALUES ($1,$2,$3,$4,$5)`,
        [filename || null, occRows.length, skillRows.length, totalSkipped, session.userId]
      );

      await client.query('COMMIT');

      const groups = new Set(occRows.map(r => r.isco_group)).size;
      return Response.json({
        data: {
          success: true,
          occupations: occRows.length,
          skills: skillRows.length,
          skipped: totalSkipped,
          message: `Imported ${occRows.length} occupations across ${groups} ISCO group${groups !== 1 ? 's' : ''} and ${skillRows.length} skill entries.${totalSkipped > 0 ? ` ${totalSkipped} rows skipped (missing required fields).` : ''}`,
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
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
