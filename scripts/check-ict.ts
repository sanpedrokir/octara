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

  console.log('\n=== All Industries ===');
  const industries = await sql`SELECT id, name FROM industries ORDER BY name`;
  for (const i of industries) console.log(`  [${i.id}] ${i.name}`);

  console.log('\n=== ICT-related industries (job role count) ===');
  const ict = await sql`
    SELECT i.id, i.name, COUNT(jr.id) AS role_count
    FROM industries i
    LEFT JOIN job_roles jr ON jr.industry_id = i.id
    WHERE i.name ILIKE '%information%' OR i.name ILIKE '%commun%' OR i.name ILIKE '%tech%'
    GROUP BY i.id, i.name ORDER BY i.name
  `;
  for (const i of ict) console.log(`  [${i.id}] ${i.name} — ${i.role_count} roles`);

  console.log('\n=== Job roles for ICT industries ===');
  for (const i of ict) {
    const roles = await sql`SELECT name FROM job_roles WHERE industry_id = ${i.id} ORDER BY name`;
    if (roles.length > 0) {
      console.log(`\n  [${i.name}]`);
      for (const r of roles) console.log(`    - ${r.name}`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
