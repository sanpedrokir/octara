import ExcelJS from 'exceljs';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

const BLUE = 'FF003399';
const WHITE = 'FFFFFFFF';
const LIGHT = 'FFE8F0FE';

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: WHITE } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  row.alignment = { vertical: 'middle' };
  row.height = 20;
}

function styleNote(row: ExcelJS.Row) {
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
  row.font = { italic: true, size: 9 };
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session || session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'EduSoraX';
  wb.created = new Date();

  // ── Sheet 1: Occupations ──────────────────────────────────────────────
  const occ = wb.addWorksheet('ESCO Occupations');
  occ.columns = [
    { header: 'ISCO Group',            key: 'isco_group',            width: 32 },
    { header: 'Sub-Group',             key: 'sub_group',             width: 30 },
    { header: 'Occupation Title',      key: 'occupation_title',      width: 38 },
    { header: 'Description',           key: 'occupation_description',width: 55 },
    { header: 'ESCO URI',              key: 'esco_uri',              width: 60 },
  ];
  styleHeader(occ.getRow(1));

  // Sample rows
  occ.addRow({ isco_group: 'ICT Professionals', sub_group: 'Software and Applications Developers', occupation_title: 'Software Developer', occupation_description: 'Software developers design, build, test and deploy software systems and applications.', esco_uri: 'http://data.europa.eu/esco/occupation/c40a2919-d5b3-423e-8d38-9e1a50e8f9c6' });
  occ.addRow({ isco_group: 'Managers', sub_group: 'ICT Service Managers', occupation_title: 'ICT Project Manager', occupation_description: 'ICT project managers plan, direct and coordinate ICT-related project activities.', esco_uri: 'http://data.europa.eu/esco/occupation/3dc2a579-1c5c-42de-8b6d-3c5c55b44c6e' });

  // Freeze header row
  occ.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Sheet 2: Skills ───────────────────────────────────────────────────
  const sk = wb.addWorksheet('ESCO Skills');
  sk.columns = [
    { header: 'Occupation Title', key: 'occupation_title',  width: 38 },
    { header: 'Skill Title',      key: 'skill_title',       width: 42 },
    { header: 'Skill Type',       key: 'skill_type',        width: 16 },
    { header: 'ESCO Skill URI',   key: 'esco_skill_uri',    width: 60 },
  ];
  styleHeader(sk.getRow(1));

  sk.addRow({ occupation_title: 'Software Developer', skill_title: 'software programming', skill_type: 'skill', esco_skill_uri: 'http://data.europa.eu/esco/skill/021d2503-2060-42dd-a53d-9cf906c14778' });
  sk.addRow({ occupation_title: 'Software Developer', skill_title: 'ICT project management', skill_type: 'knowledge', esco_skill_uri: 'http://data.europa.eu/esco/skill/b633a3bc-2d24-48ac-a7e5-d1bd94f55b84' });
  sk.addRow({ occupation_title: 'ICT Project Manager', skill_title: 'manage ICT project', skill_type: 'skill', esco_skill_uri: 'http://data.europa.eu/esco/skill/98d17d9e-fb44-4d01-86f3-e67de32fbc06' });

  sk.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Sheet 3: Instructions ─────────────────────────────────────────────
  const info = wb.addWorksheet('Instructions');
  info.getColumn(1).width = 28;
  info.getColumn(2).width = 70;

  const heading = info.addRow(['ESCO Data Upload Template — Instructions']);
  heading.font = { bold: true, size: 14 };
  info.addRow([]);

  const h2a = info.addRow(['Sheet 1 — ESCO Occupations']);
  h2a.font = { bold: true };
  styleNote(info.addRow(['ISCO Group', 'ISCO major/sub-group acting as the Sector (e.g. "ICT Professionals"). Required.']));
  styleNote(info.addRow(['Sub-Group', 'Occupation sub-category acting as the Track. Optional.']));
  styleNote(info.addRow(['Occupation Title', 'The ESCO occupation name — must match exactly what you use in the Skills sheet. Required.']));
  styleNote(info.addRow(['Description', 'Short description of the occupation. Optional.']));
  styleNote(info.addRow(['ESCO URI', 'Unique ESCO concept URI (from esco.ec.europa.eu). Optional but recommended.']));

  info.addRow([]);
  const h2b = info.addRow(['Sheet 2 — ESCO Skills']);
  h2b.font = { bold: true };
  styleNote(info.addRow(['Occupation Title', 'Must exactly match the Occupation Title in Sheet 1. Required.']));
  styleNote(info.addRow(['Skill Title', 'ESCO skill/knowledge/competence name. Required.']));
  styleNote(info.addRow(['Skill Type', 'One of: skill · knowledge · attitude · competence. Optional.']));
  styleNote(info.addRow(['ESCO Skill URI', 'Unique ESCO skill URI. Optional but recommended.']));

  info.addRow([]);
  info.addRow(['Source', 'Download ESCO data free from https://esco.ec.europa.eu/en/use-esco/download']);
  info.addRow(['Columns accepted', 'The parser is flexible — column names from the ESCO CSV download are also accepted (preferredLabel, conceptUri, etc.).']);

  const buf = await wb.xlsx.writeBuffer();

  return new Response(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="esco_upload_template.xlsx"',
    },
  });
}
