import { readFileSync } from 'fs';
import path from 'path';

const env = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) process.env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
}

import { db } from '../lib/db';

async function main() {
  const sql = db();
  const rows = await sql`
    SELECT i.name AS industry, COUNT(jr.id) AS role_count
    FROM industries i
    LEFT JOIN job_roles jr ON jr.industry_id = i.id
    GROUP BY i.id, i.name ORDER BY role_count ASC, i.name
  `;
  for (const r of rows) console.log(`${String(r.role_count).padStart(3)}  ${r.industry}`);
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
