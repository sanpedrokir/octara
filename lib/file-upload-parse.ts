import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

export function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z]/g, '');
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // exceljs pulls in a stale transitive @types/node (via fast-csv) whose Buffer type
  // structurally clashes with this project's @types/node — interop cast only, same runtime object.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

function headerRowOf(worksheet: ExcelJS.Worksheet): string[] {
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim();
  });
  return headers;
}

/** Cheap pass: header row only, for every sheet — used to pick the right sheet without parsing unrelated large sheets. */
function listSheetHeaders(workbook: ExcelJS.Workbook): { name: string; headers: string[] }[] {
  return workbook.worksheets.map(ws => ({ name: ws.name, headers: headerRowOf(ws).filter(Boolean) }));
}

/** Picks the sheet whose header row matches the most known field aliases. Returns undefined if nothing matches at all. */
function pickSheetByAliases(sheets: { name: string; headers: string[] }[], headerAliases: Record<string, string>): string | undefined {
  let best: string | undefined;
  let bestScore = 0;
  for (const sheet of sheets) {
    const score = sheet.headers.filter(h => headerAliases[normaliseHeader(h)]).length;
    if (score > bestScore) {
      bestScore = score;
      best = sheet.name;
    }
  }
  return best;
}

function extractRowsFromSheet(workbook: ExcelJS.Workbook, sheetName: string): Record<string, string>[] {
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) return [];
  const headers = headerRowOf(worksheet);

  const rows: Record<string, string>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) obj[header] = cell.text ?? String(cell.value ?? '');
    });
    rows.push(obj);
  });
  return rows;
}

/**
 * Parses an XLSX buffer that may contain multiple sheets (e.g. several reference tables in one workbook),
 * extracting rows for several known schemas at once — each schema picks its own best-matching sheet by
 * header score, so unrelated/large sheets are never fully parsed.
 */
export async function parseXlsxSchemas<T extends string>(
  buffer: Buffer,
  schemas: Record<T, Record<string, string>>
): Promise<Record<T, { rows: Record<string, string>[]; sourceHeaders: string[]; sheetName?: string }>> {
  const workbook = await loadWorkbook(buffer);
  const sheetHeaders = listSheetHeaders(workbook);

  const result = {} as Record<T, { rows: Record<string, string>[]; sourceHeaders: string[]; sheetName?: string }>;
  for (const key of Object.keys(schemas) as T[]) {
    const sheetName = pickSheetByAliases(sheetHeaders, schemas[key]);
    const rows = sheetName ? extractRowsFromSheet(workbook, sheetName) : [];
    const sourceHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
    result[key] = { rows, sourceHeaders, sheetName };
  }
  return result;
}

/**
 * Parses a CSV or single-schema XLSX buffer into row objects keyed by source column header.
 * For XLSX files with multiple sheets (e.g. a reference "Legend" sheet plus the real "data" sheet),
 * picks the sheet whose header row matches the most known field aliases — not just the first sheet.
 */
export async function parseTabularFile(
  buffer: Buffer,
  ext: string,
  headerAliases: Record<string, string>
): Promise<{ rows: Record<string, string>[]; sourceHeaders: string[]; sheetName?: string }> {
  if (ext === 'csv') {
    const rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    return { rows, sourceHeaders: rows.length > 0 ? Object.keys(rows[0]) : [] };
  }

  if (ext === 'xlsx') {
    const result = await parseXlsxSchemas(buffer, { main: headerAliases });
    return result.main;
  }

  throw new Error('Unsupported file type. Please upload a .xlsx or .csv file (legacy .xls is not supported — re-save as .xlsx).');
}
