import { readFileSync } from 'fs';
import path from 'path';

const env = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) process.env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
}

import { db } from '../lib/db';

// keepId = industry to keep (has more/better roles)
// dropId = industry to delete (merge its roles into keepId first)
// canonicalName = final name for the kept industry
const MERGES = [
  { keepId: 1,  dropId: 34, canonicalName: 'Information & Communications Technology' },
  { keepId: 2,  dropId: 28, canonicalName: 'Finance & Banking' },
  { keepId: 3,  dropId: 31, canonicalName: 'Healthcare & Life Sciences' },
  { keepId: 7,  dropId: 33, canonicalName: 'Human Resources & Recruitment' },
  { keepId: 8,  dropId: 37, canonicalName: 'Legal' },
  { keepId: 9,  dropId: 44, canonicalName: 'Retail & E-commerce' },
  { keepId: 10, dropId: 38, canonicalName: 'Logistics & Supply Chain' },
  { keepId: 11, dropId: 21, canonicalName: 'Construction & Built Environment' },
  { keepId: 12, dropId: 40, canonicalName: 'Media & Entertainment' },
];

async function main() {
  const sql = db();

  for (const { keepId, dropId, canonicalName } of MERGES) {
    const [keep] = await sql`SELECT id, name FROM industries WHERE id = ${keepId}`;
    const [drop] = await sql`SELECT id, name FROM industries WHERE id = ${dropId}`;
    if (!keep || !drop) {
      console.log(`  Skipping keepId=${keepId} dropId=${dropId} — one or both not found`);
      continue;
    }

    console.log(`\nMerging [${dropId}] "${drop.name}" → [${keepId}] "${keep.name}"`);

    // Move unique job roles from drop → keep
    const dropRoles = await sql`SELECT name FROM job_roles WHERE industry_id = ${dropId}`;
    const keepRoleNames = (await sql`SELECT name FROM job_roles WHERE industry_id = ${keepId}`).map(r => (r.name as string).toLowerCase());
    let moved = 0;
    for (const role of dropRoles) {
      if (!keepRoleNames.includes((role.name as string).toLowerCase())) {
        await sql`UPDATE job_roles SET industry_id = ${keepId} WHERE industry_id = ${dropId} AND name = ${role.name}`;
        console.log(`  + Moved role: ${role.name}`);
        moved++;
      }
    }
    // Delete remaining roles in drop (duplicates)
    await sql`DELETE FROM job_roles WHERE industry_id = ${dropId}`;

    // Update career_aspirations referencing drop → keep
    const caUpdated = await sql`
      UPDATE career_aspirations SET industry_id = ${keepId} WHERE industry_id = ${dropId} RETURNING id
    `;
    if (caUpdated.length > 0) console.log(`  Updated ${caUpdated.length} career aspiration(s)`);

    // Update any user_skills referencing drop → keep (if column exists)
    await sql`UPDATE user_skills SET industry_id = ${keepId} WHERE industry_id = ${dropId}`.catch(() => {});

    // Delete the duplicate industry
    await sql`DELETE FROM industries WHERE id = ${dropId}`;

    // Rename the kept industry to the canonical name
    await sql`UPDATE industries SET name = ${canonicalName} WHERE id = ${keepId}`;

    const [roleCount] = await sql`SELECT COUNT(*) AS count FROM job_roles WHERE industry_id = ${keepId}`;
    console.log(`  ✅ "${canonicalName}" now has ${roleCount.count} roles (moved ${moved} new)`);
  }

  console.log('\n=== Final industry list ===');
  const all = await sql`
    SELECT i.name, COUNT(jr.id) AS roles
    FROM industries i
    LEFT JOIN job_roles jr ON jr.industry_id = i.id
    GROUP BY i.id, i.name ORDER BY i.name
  `;
  for (const i of all) console.log(`  ${i.name} (${i.roles} roles)`);

  process.exit(0);
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
