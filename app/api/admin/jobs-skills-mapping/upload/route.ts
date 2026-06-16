import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { normaliseHeader, parseTabularFile } from '@/lib/file-upload-parse';

export const runtime = 'nodejs';
export const maxDuration = 60;

type MappingRow = {
  skill_code: string | null;
  skill_title: string;
  skill_desc: string | null;
  skill_proficiency_level: string | null;
  proficiency_level_desc: string | null;
  previous_skill_title: string | null;
  previous_skill_desc: string | null;
  previous_sfs_status: string | null;
  previous_casl_status: string | null;
  previous_skill_type: string | null;
  updated_skill_title: string | null;
  updated_skill_desc: string | null;
  updated_skill_sfs_status: string | null;
  updated_casl_status: string | null;
  updated_skill_type: string | null;
  updated_sector_tagging: string | null;
};

const FIELD_ORDER: (keyof MappingRow)[] = [
  'skill_code', 'skill_title', 'skill_desc', 'skill_proficiency_level', 'proficiency_level_desc',
  'previous_skill_title', 'previous_skill_desc', 'previous_sfs_status', 'previous_casl_status', 'previous_skill_type',
  'updated_skill_title', 'updated_skill_desc', 'updated_skill_sfs_status', 'updated_casl_status', 'updated_skill_type',
  'updated_sector_tagging',
];

const HEADER_ALIASES: Record<string, keyof MappingRow> = {
  skillsframeworkskillcode: 'skill_code',
  skillsframeworkskilltitle: 'skill_title',
  skillsframeworkskilldesc: 'skill_desc',
  skillsframeworkskillpl: 'skill_proficiency_level',
  skillsframeworkpldesc: 'proficiency_level_desc',
  uniqueskillpreviousskilltitle: 'previous_skill_title',
  uniqueskillpreviousskilldesc: 'previous_skill_desc',
  uniqueskillprevioussfsstatus: 'previous_sfs_status',
  uniqueskillpreviouscaslstatus: 'previous_casl_status',
  uniqueskillpreviousskilltype: 'previous_skill_type',
  uniqueskillupdatedskilltitle: 'updated_skill_title',
  uniqueskillupdatedskilldesc: 'updated_skill_desc',
  uniqueskillupdatedskillsfsstatus: 'updated_skill_sfs_status',
  uniqueskillupdatedcaslstatus: 'updated_casl_status',
  uniqueskillupdatedskilltype: 'updated_skill_type',
  uniqueskillupdatedsectortagging: 'updated_sector_tagging',
};

function rowsFromSheet(sheetRows: Record<string, string>[]): { rows: MappingRow[]; skipped: number } {
  const sourceHeaders = sheetRows.length > 0 ? Object.keys(sheetRows[0]) : [];
  const headerMap = new Map<string, keyof MappingRow>();
  for (const h of sourceHeaders) {
    const target = HEADER_ALIASES[normaliseHeader(h)];
    if (target) headerMap.set(h, target);
  }

  let skipped = 0;
  const rows: MappingRow[] = [];
  for (const raw of sheetRows) {
    const row: Partial<MappingRow> = {};
    for (const [sourceHeader, field] of headerMap) {
      const value = String(raw[sourceHeader] ?? '').trim();
      row[field] = (value || null) as never;
    }
    if (!row.skill_title) {
      skipped++;
      continue;
    }
    const full: MappingRow = { skill_title: row.skill_title } as MappingRow;
    for (const field of FIELD_ORDER) {
      full[field] = (row[field] ?? null) as never;
    }
    rows.push(full);
  }
  return { rows, skipped };
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
    const buffer = Buffer.from(await file.arrayBuffer());

    const { rows: sheetRows, sourceHeaders, sheetName } = await parseTabularFile(buffer, ext, HEADER_ALIASES);

    if (sheetRows.length === 0) {
      return Response.json({ data: null, error: 'The file has no data rows' }, { status: 400 });
    }

    const { rows, skipped } = rowsFromSheet(sheetRows);

    if (rows.length === 0) {
      return Response.json({
        data: null,
        error: `No valid rows found in sheet "${sheetName ?? 'unknown'}". Each row needs at least a Skill Title. Found columns: ` + sourceHeaders.join(', '),
      }, { status: 400 });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE jobs_skills_mapping RESTART IDENTITY');

      // One query for the whole table — array params + UNNEST instead of looping batched round-trips.
      const arrays = FIELD_ORDER.map(field => rows.map(r => r[field] ?? null));
      const castList = FIELD_ORDER.map((_, i) => `$${i + 1}::text[]`).join(', ');
      await client.query(
        `INSERT INTO jobs_skills_mapping (${FIELD_ORDER.join(', ')}) SELECT * FROM UNNEST(${castList})`,
        arrays
      );

      await client.query(
        `INSERT INTO jobs_skills_mapping_uploads (filename, row_count, skipped_count, uploaded_by)
         VALUES ($1, $2, $3, $4)`,
        [filename || null, rows.length, skipped, session.userId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const sectorCount = new Set(rows.map(r => r.updated_sector_tagging).filter(Boolean)).size;

    return Response.json({
      data: {
        success: true,
        inserted: rows.length,
        skipped,
        sectors: sectorCount,
        message: `Replaced jobs & skills mapping with ${rows.length} skill records across ${sectorCount} sectors${skipped > 0 ? ` (${skipped} rows skipped — missing Skill Title)` : ''}`,
      },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}
