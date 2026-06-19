import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { normaliseHeader, parseTabularFile } from '@/lib/file-upload-parse';

export const runtime = 'nodejs';
export const maxDuration = 60;

type TscRow = {
  track: string | null;
  job_role: string;
  skill_title: string;
  skill_type: string | null;
  proficiency_level: string | null;
  skill_code: string | null;
};

const TSC_ALIASES: Record<string, keyof TscRow> = {
  track: 'track',
  jobrole: 'job_role',
  tscccstitle: 'skill_title',
  tscccstype: 'skill_type',
  proficiencylevel: 'proficiency_level',
  tscccscode: 'skill_code',
};

function mapRows(sheetRows: Record<string, string>[]): { rows: TscRow[]; skipped: number; sourceHeaders: string[] } {
  const sourceHeaders = sheetRows.length > 0 ? Object.keys(sheetRows[0]) : [];
  const headerMap = new Map<string, keyof TscRow>();
  for (const h of sourceHeaders) {
    const target = TSC_ALIASES[normaliseHeader(h)];
    if (target) headerMap.set(h, target);
  }

  let skipped = 0;
  const rows: TscRow[] = [];
  for (const raw of sheetRows) {
    const row: Partial<TscRow> = {};
    for (const [src, field] of headerMap) {
      const value = String(raw[src] ?? '').trim();
      row[field] = (value || null) as never;
    }
    if (!row.job_role || !row.skill_title) { skipped++; continue; }
    rows.push(row as TscRow);
  }
  return { rows, skipped, sourceHeaders };
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

    if (!['csv', 'xlsx'].includes(ext)) {
      return Response.json({ data: null, error: 'Please upload .xlsx or .csv (.xls is not supported — re-save as .xlsx)' }, { status: 400 });
    }

    // parseTabularFile handles both CSV and XLSX — picks the sheet whose headers best match TSC_ALIASES
    const parsed = await parseTabularFile(buffer, ext, TSC_ALIASES);
    const sheetRows = parsed.rows;
    const sourceHeaders = parsed.sourceHeaders;

    if (sheetRows.length === 0) {
      return Response.json({ data: null, error: 'File has no data rows' }, { status: 400 });
    }

    const { rows, skipped, sourceHeaders: detectedHeaders } = mapRows(sheetRows);
    if (rows.length === 0) {
      return Response.json({
        data: null,
        error: `No valid rows found. Each row needs at least Job Role and TSC/CCS Title. Detected columns: ${detectedHeaders.join(', ')}`,
      }, { status: 400 });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      // Look up sector for each unique job_role from the catalog table
      const uniqueJobRoles = [...new Set(rows.map(r => r.job_role.toLowerCase().trim()))];
      const sectorResult = await client.query(
        `SELECT DISTINCT LOWER(TRIM(job_role)) AS job_role_key, sector
         FROM job_role_catalog
         WHERE LOWER(TRIM(job_role)) = ANY($1::text[])`,
        [uniqueJobRoles]
      );
      const sectorMap = new Map<string, string>();
      for (const r of sectorResult.rows) sectorMap.set(r.job_role_key, r.sector);

      // Enrich rows with sector (fallback to 'Unknown' if not in catalog)
      const enriched = rows.map(r => ({
        ...r,
        sector: sectorMap.get(r.job_role.toLowerCase().trim()) ?? 'Unknown',
      }));

      await client.query('BEGIN');

      // Upsert: delete existing rows matching same (job_role, skill_code) pairs then bulk insert
      const jobRoleArr = enriched.map(r => r.job_role);
      const skillCodeArr = enriched.map(r => r.skill_code ?? '');

      await client.query(
        `WITH to_delete AS (
           SELECT unnest($1::text[]) AS job_role, unnest($2::text[]) AS skill_code
         )
         DELETE FROM job_role_tsc_ccs t
         USING to_delete d
         WHERE LOWER(TRIM(t.job_role)) = LOWER(TRIM(d.job_role))
           AND (t.skill_code = d.skill_code OR (t.skill_code IS NULL AND d.skill_code = ''))`,
        [jobRoleArr, skillCodeArr]
      );

      // Bulk insert via unnest
      const cols = ['sector', 'track', 'job_role', 'skill_title', 'skill_type', 'proficiency_level', 'skill_code'];
      const arrays = cols.map(col => enriched.map(r => (r as Record<string, unknown>)[col] ?? null));
      const castList = cols.map((_, i) => `$${i + 1}::text[]`).join(', ');
      await client.query(
        `INSERT INTO job_role_tsc_ccs (${cols.join(', ')}) SELECT * FROM UNNEST(${castList})`,
        arrays
      );

      // Record the upload
      await client.query(
        `INSERT INTO job_role_catalog_uploads (filename, row_count, skipped_count, uploaded_by)
         VALUES ($1, $2, $3, $4)`,
        [filename || null, enriched.length, skipped, session.userId]
      );

      await client.query('COMMIT');

      const matched = enriched.filter(r => r.sector !== 'Unknown').length;
      const unmatched = enriched.length - matched;
      const tracks = new Set(enriched.map(r => r.track).filter(Boolean)).size;

      return Response.json({
        data: {
          success: true,
          inserted: enriched.length,
          skipped,
          matched,
          unmatched,
          message: `Upserted ${enriched.length} TSC/CCS entries across ${tracks} tracks. ${matched} job roles matched to catalog sectors${unmatched > 0 ? `, ${unmatched} unmatched (sector set to Unknown)` : ''}.${skipped > 0 ? ` ${skipped} rows skipped (missing Job Role or Skill Title).` : ''}`,
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
