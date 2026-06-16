import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { normaliseHeader, parseTabularFile, parseXlsxSchemas } from '@/lib/file-upload-parse';

export const runtime = 'nodejs';
export const maxDuration = 60;

type CatalogRow = {
  sector: string;
  track: string | null;
  job_role: string;
  job_role_description: string | null;
  performance_expectation: string | null;
};

type CwfRow = {
  sector: string;
  track: string | null;
  job_role: string;
  critical_work_function: string;
  key_task: string | null;
};

type TscCcsRow = {
  sector: string;
  track: string | null;
  job_role: string;
  skill_title: string;
  skill_type: string | null;
  proficiency_level: string | null;
  skill_code: string | null;
};

const CATALOG_ALIASES: Record<string, keyof CatalogRow> = {
  sector: 'sector',
  track: 'track',
  jobrole: 'job_role',
  jobroledescription: 'job_role_description',
  performanceexpectation: 'performance_expectation',
};

const CWF_ALIASES: Record<string, keyof CwfRow> = {
  sector: 'sector',
  track: 'track',
  jobrole: 'job_role',
  criticalworkfunction: 'critical_work_function',
  keytasks: 'key_task',
};

const TSC_CCS_ALIASES: Record<string, keyof TscCcsRow> = {
  sector: 'sector',
  track: 'track',
  jobrole: 'job_role',
  tscccstitle: 'skill_title',
  tscccstype: 'skill_type',
  proficiencylevel: 'proficiency_level',
  tscccscode: 'skill_code',
};

function mapRows<T extends Record<string, unknown>>(
  sheetRows: Record<string, string>[],
  aliases: Record<string, keyof T>,
  requiredFields: (keyof T)[]
): { rows: T[]; skipped: number } {
  const sourceHeaders = sheetRows.length > 0 ? Object.keys(sheetRows[0]) : [];
  const headerMap = new Map<string, keyof T>();
  for (const h of sourceHeaders) {
    const target = aliases[normaliseHeader(h)];
    if (target) headerMap.set(h, target);
  }

  let skipped = 0;
  const rows: T[] = [];
  for (const raw of sheetRows) {
    const row: Partial<T> = {};
    for (const [sourceHeader, field] of headerMap) {
      const value = String(raw[sourceHeader] ?? '').trim();
      row[field] = (value || null) as never;
    }
    if (requiredFields.some(f => !row[f])) {
      skipped++;
      continue;
    }
    rows.push(row as T);
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

    let catalogSheetRows: Record<string, string>[];
    let cwfSheetRows: Record<string, string>[] = [];
    let tscCcsSheetRows: Record<string, string>[] = [];
    let catalogSourceHeaders: string[];

    if (ext === 'csv') {
      const parsed = await parseTabularFile(buffer, ext, CATALOG_ALIASES);
      catalogSheetRows = parsed.rows;
      catalogSourceHeaders = parsed.sourceHeaders;
      // CSV is a flat single-table format — Critical Work Function and TSC/CCS sheets only exist in the
      // full multi-sheet SSG XLSX export, so they're left untouched (not truncated) on a CSV-only upload.
    } else if (ext === 'xlsx') {
      const schemas = await parseXlsxSchemas(buffer, { catalog: CATALOG_ALIASES, cwf: CWF_ALIASES, tscCcs: TSC_CCS_ALIASES });
      catalogSheetRows = schemas.catalog.rows;
      catalogSourceHeaders = schemas.catalog.sourceHeaders;
      cwfSheetRows = schemas.cwf.rows;
      tscCcsSheetRows = schemas.tscCcs.rows;
    } else {
      return Response.json({ data: null, error: 'Unsupported file type. Please upload a .xlsx or .csv file (legacy .xls is not supported — re-save as .xlsx).' }, { status: 400 });
    }

    if (catalogSheetRows.length === 0) {
      return Response.json({ data: null, error: 'The file has no data rows' }, { status: 400 });
    }

    const { rows: catalogRows, skipped } = mapRows<CatalogRow>(catalogSheetRows, CATALOG_ALIASES, ['sector', 'job_role']);
    if (catalogRows.length === 0) {
      return Response.json({
        data: null,
        error: 'No valid rows found. Each row needs at least Sector and Job Role. Found columns: ' + catalogSourceHeaders.join(', '),
      }, { status: 400 });
    }

    const { rows: cwfRows } = mapRows<CwfRow>(cwfSheetRows, CWF_ALIASES, ['sector', 'job_role', 'critical_work_function']);
    const { rows: tscCcsRows } = mapRows<TscCcsRow>(tscCcsSheetRows, TSC_CCS_ALIASES, ['sector', 'job_role', 'skill_title']);

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // DELETE (not TRUNCATE) — career_aspirations.catalog_job_role_id references this table with
      // ON DELETE SET NULL, and TRUNCATE doesn't honour that referential action like row-level DELETE does.
      await client.query('DELETE FROM job_role_catalog');
      await insertBatches(client, 'job_role_catalog',
        ['sector', 'track', 'job_role', 'job_role_description', 'performance_expectation'], catalogRows);

      if (ext === 'xlsx') {
        await client.query('TRUNCATE TABLE job_role_cwf_kt RESTART IDENTITY');
        await insertBatches(client, 'job_role_cwf_kt',
          ['sector', 'track', 'job_role', 'critical_work_function', 'key_task'], cwfRows);

        await client.query('TRUNCATE TABLE job_role_tsc_ccs RESTART IDENTITY');
        await insertBatches(client, 'job_role_tsc_ccs',
          ['sector', 'track', 'job_role', 'skill_title', 'skill_type', 'proficiency_level', 'skill_code'], tscCcsRows);
      }

      await client.query(
        `INSERT INTO job_role_catalog_uploads (filename, row_count, skipped_count, uploaded_by)
         VALUES ($1, $2, $3, $4)`,
        [filename || null, catalogRows.length, skipped, session.userId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const sectorCount = new Set(catalogRows.map(r => r.sector)).size;
    const extras: string[] = [];
    if (ext === 'xlsx') {
      extras.push(`${cwfRows.length} critical work function entries`);
      extras.push(`${tscCcsRows.length} TSC/CCS skill mappings`);
    }

    return Response.json({
      data: {
        success: true,
        inserted: catalogRows.length,
        skipped,
        sectors: sectorCount,
        cwfCount: cwfRows.length,
        tscCcsCount: tscCcsRows.length,
        message: `Replaced catalog with ${catalogRows.length} job roles across ${sectorCount} sectors${extras.length ? ` (plus ${extras.join(', ')})` : ''}${skipped > 0 ? ` — ${skipped} rows skipped (missing Sector or Job Role)` : ''}`,
      },
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return Response.json({ data: null, error: msg }, { status: 500 });
  }
}

// One query per table regardless of row count — sends each column as a single array parameter
// and unnests them, instead of looping hundreds of round-trips to the (remote) database.
async function insertBatches(
  client: { query: (text: string, values?: unknown[]) => Promise<unknown> },
  table: string,
  columns: string[],
  rows: Record<string, unknown>[]
) {
  if (rows.length === 0) return;
  const arrays = columns.map(col => rows.map(r => r[col] ?? null));
  const castList = columns.map((_, i) => `$${i + 1}::text[]`).join(', ');
  await client.query(
    `INSERT INTO ${table} (${columns.join(', ')}) SELECT * FROM UNNEST(${castList})`,
    arrays
  );
}
