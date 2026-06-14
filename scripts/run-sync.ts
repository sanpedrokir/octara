import { readFileSync } from 'fs';
import path from 'path';

// Load env
const env = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) process.env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
}

import { fetchAllSsgJobRoles } from '../lib/ssg-skills-api';
import { db } from '../lib/db';

async function main() {
  console.log('Fetching live data from SSG Skills Framework API...');
  const start = Date.now();
  const { sectors, jobRoles, total } = await fetchAllSsgJobRoles();
  console.log(`Fetched ${sectors.length} sectors, ${jobRoles.length} job roles (SSG total: ${total}) in ${((Date.now()-start)/1000).toFixed(1)}s`);

  if (sectors.length === 0 || jobRoles.length === 0) {
    console.error('No data returned — aborting sync.');
    process.exit(1);
  }

  const sql = db();
  let industriesAdded = 0, industriesUpdated = 0, rolesAdded = 0, rolesUpdated = 0;

  // Upsert sectors → industries
  const sectorIdToDbId = new Map<string, number>();
  for (const sector of sectors) {
    const existing = await sql`SELECT id FROM industries WHERE name = ${sector.name}`;
    if (existing.length > 0) {
      sectorIdToDbId.set(sector.id, existing[0].id as number);
      industriesUpdated++;
    } else {
      const [row] = await sql`INSERT INTO industries (name) VALUES (${sector.name}) RETURNING id`;
      sectorIdToDbId.set(sector.id, row.id as number);
      industriesAdded++;
    }
  }

  // Upsert job roles
  for (const role of jobRoles) {
    const industryDbId = sectorIdToDbId.get(role.sectorId);
    if (!industryDbId) continue;
    const existing = await sql`SELECT id FROM job_roles WHERE industry_id = ${industryDbId} AND name = ${role.title}`;
    if (existing.length > 0) {
      rolesUpdated++;
    } else {
      await sql`INSERT INTO job_roles (industry_id, name) VALUES (${industryDbId}, ${role.title})`;
      rolesAdded++;
    }
  }

  const [indCount] = await sql`SELECT COUNT(*) AS count FROM industries`;
  const [roleCount] = await sql`SELECT COUNT(*) AS count FROM job_roles`;

  console.log('\n✅ Sync complete!');
  console.log(`Industries: ${industriesAdded} added, ${industriesUpdated} already existed  →  ${indCount.count} total in DB`);
  console.log(`Job roles:  ${rolesAdded} added, ${rolesUpdated} already existed  →  ${roleCount.count} total in DB`);
  console.log('Source: LIVE from SSG Skills Framework API');
}

main().catch(e => { console.error('Sync failed:', e.message); process.exit(1); });
