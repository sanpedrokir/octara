import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ESCO_API = 'https://esco.ec.europa.eu/api';
const PAGE_SIZE = 100;

// ISCO-08 major group labels (first digit of ISCO code)
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

type EscoResult = {
  uri: string;
  preferredLabel: string;
  description?: string;
  iscoGroup?: { code?: string; preferredLabel?: string };
};

async function fetchPage(offset: number): Promise<{ results: EscoResult[]; total: number }> {
  const url = `${ESCO_API}/search?type=occupation&language=en&limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    next: { revalidate: 0 } as any,
  });
  if (!res.ok) throw new Error(`ESCO API returned ${res.status} — ${await res.text().then(t => t.slice(0, 200))}`);
  const json = await res.json();
  return {
    results: (json._embedded?.results ?? []) as EscoResult[],
    total:   Number(json.total ?? 0),
  };
}

async function fetchSkillPage(offset: number): Promise<{ results: EscoResult[]; total: number }> {
  const url = `${ESCO_API}/search?type=skill&language=en&limit=${PAGE_SIZE}&offset=${offset}&skillType=skill%2Fcompetence`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`ESCO skills API returned ${res.status}`);
  const json = await res.json();
  return {
    results: (json._embedded?.results ?? []) as EscoResult[],
    total:   Number(json.total ?? 0),
  };
}

async function fetchKnowledgePage(offset: number): Promise<{ results: EscoResult[]; total: number }> {
  const url = `${ESCO_API}/search?type=skill&language=en&limit=${PAGE_SIZE}&offset=${offset}&skillType=knowledge`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`ESCO knowledge API returned ${res.status}`);
  const json = await res.json();
  return {
    results: (json._embedded?.results ?? []) as EscoResult[],
    total:   Number(json.total ?? 0),
  };
}

async function ensureEscoTables(client: { query: (sql: string) => Promise<unknown> }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS esco_job_catalog (
      id SERIAL PRIMARY KEY, isco_group TEXT NOT NULL, sub_group TEXT,
      occupation_title TEXT NOT NULL, occupation_description TEXT, esco_uri TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
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
    CREATE TABLE IF NOT EXISTS esco_standalone_skills (
      id SERIAL PRIMARY KEY, skill_title TEXT NOT NULL, skill_type TEXT,
      description TEXT, esco_skill_uri TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
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

    const body = await request.json().catch(() => ({})) as { mode?: string };
    const mode = body.mode ?? 'occupations'; // 'occupations' | 'skills' | 'all'

    const pool = getPool();
    const client = await pool.connect();
    try {
      await ensureEscoTables(client as unknown as Parameters<typeof ensureEscoTables>[0]);
      await client.query('BEGIN');

      let occCount = 0;
      let skillCount = 0;

      // ── Fetch occupations ───────────────────────────────────────────────
      if (mode === 'occupations' || mode === 'all') {
        await client.query('TRUNCATE esco_job_catalog RESTART IDENTITY');

        const first = await fetchPage(0);
        const total = first.total;
        const allOcc: EscoResult[] = [...first.results];

        // Fetch remaining pages (up to 50 pages = 5000 occupations — ESCO has ~3000)
        const pages = Math.min(Math.ceil(total / PAGE_SIZE), 50);
        const pagePromises: Promise<{ results: EscoResult[]; total: number }>[] = [];
        for (let i = 1; i < pages; i++) {
          pagePromises.push(fetchPage(i * PAGE_SIZE));
        }
        // Batch in groups of 5 to avoid overwhelming the ESCO API
        for (let b = 0; b < pagePromises.length; b += 5) {
          const batch = await Promise.all(pagePromises.slice(b, b + 5));
          for (const p of batch) allOcc.push(...p.results);
        }

        if (allOcc.length > 0) {
          const isco_groups: (string | null)[]  = [];
          const sub_groups: (string | null)[]   = [];
          const titles: string[]                 = [];
          const descs: (string | null)[]         = [];
          const uris: (string | null)[]          = [];

          for (const r of allOcc) {
            const iscoCode = r.iscoGroup?.code ?? '';
            const majorKey = iscoCode.charAt(0);
            const iscoGroup = ISCO_MAJOR[majorKey] ?? r.iscoGroup?.preferredLabel ?? 'Other';
            const subGroup  = r.iscoGroup?.preferredLabel ?? null;
            isco_groups.push(iscoGroup);
            sub_groups.push(subGroup);
            titles.push(r.preferredLabel || 'Unknown');
            descs.push(r.description ? String(r.description).slice(0, 1000) : null);
            uris.push(r.uri || null);
          }

          await client.query(
            `INSERT INTO esco_job_catalog (isco_group, sub_group, occupation_title, occupation_description, esco_uri)
             SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])`,
            [isco_groups, sub_groups, titles, descs, uris]
          );
          occCount = allOcc.length;
        }
      }

      // ── Fetch skills & competences ──────────────────────────────────────
      if (mode === 'skills' || mode === 'all') {
        // Ensure standalone skills table exists (created above)
        await client.query('TRUNCATE esco_standalone_skills RESTART IDENTITY');

        const allSkills: (EscoResult & { skillType: string })[] = [];

        // Fetch skill/competence type
        const firstSk = await fetchSkillPage(0);
        const totalSk = firstSk.total;
        const skPages  = Math.min(Math.ceil(totalSk / PAGE_SIZE), 100);
        allSkills.push(...firstSk.results.map(r => ({ ...r, skillType: 'skill/competence' })));
        for (let b = 0; b < skPages - 1; b += 5) {
          const batch = await Promise.all(
            Array.from({ length: Math.min(5, skPages - 1 - b) }, (_, i) => fetchSkillPage((b + i + 1) * PAGE_SIZE))
          );
          for (const p of batch) allSkills.push(...p.results.map(r => ({ ...r, skillType: 'skill/competence' })));
        }

        // Fetch knowledge type
        const firstKn = await fetchKnowledgePage(0);
        const totalKn = firstKn.total;
        const knPages  = Math.min(Math.ceil(totalKn / PAGE_SIZE), 100);
        allSkills.push(...firstKn.results.map(r => ({ ...r, skillType: 'knowledge' })));
        for (let b = 0; b < knPages - 1; b += 5) {
          const batch = await Promise.all(
            Array.from({ length: Math.min(5, knPages - 1 - b) }, (_, i) => fetchKnowledgePage((b + i + 1) * PAGE_SIZE))
          );
          for (const p of batch) allSkills.push(...p.results.map(r => ({ ...r, skillType: 'knowledge' })));
        }

        if (allSkills.length > 0) {
          const stitles: string[]         = [];
          const stypes: (string | null)[] = [];
          const sdescs: (string | null)[] = [];
          const suris: (string | null)[]  = [];
          for (const s of allSkills) {
            stitles.push(s.preferredLabel || 'Unknown');
            stypes.push(s.skillType);
            sdescs.push(s.description ? String(s.description).slice(0, 500) : null);
            suris.push(s.uri || null);
          }
          await client.query(
            `INSERT INTO esco_standalone_skills (skill_title, skill_type, description, esco_skill_uri)
             SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[])`,
            [stitles, stypes, sdescs, suris]
          );
          skillCount = allSkills.length;
        }
      }

      // Record the import
      await client.query(
        `INSERT INTO esco_uploads (filename, occ_count, skill_count, skipped_count, uploaded_by)
         VALUES ($1, $2, $3, 0, $4)`,
        [`ESCO API auto-import (${mode})`, occCount, skillCount, session.userId]
      );

      await client.query('COMMIT');

      const parts: string[] = [];
      if (occCount > 0) parts.push(`${occCount} occupations`);
      if (skillCount > 0) parts.push(`${skillCount} skills & competences`);

      return Response.json({
        data: {
          success: true,
          occupations: occCount,
          skills: skillCount,
          message: `Successfully imported ${parts.join(' and ')} from the ESCO API.`,
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
    const msg = err instanceof Error ? err.message : 'Fetch failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
