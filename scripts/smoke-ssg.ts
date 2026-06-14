import { readFileSync } from 'fs';
import path from 'path';

const env = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) {
    const k = line.slice(0, eqIdx).trim();
    const v = line.slice(eqIdx + 1).trim();
    process.env[k] = v;
  }
}

import { fetchAllSsgJobRoles } from '../lib/ssg-skills-api';

async function main() {
  console.log('Client ID set:', !!process.env.SSG_CLIENT_ID, process.env.SSG_CLIENT_ID?.slice(0, 8));
  console.log('Fetching all SSG job roles...');
  const start = Date.now();
  const { sectors, jobRoles, total } = await fetchAllSsgJobRoles();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`Done in ${elapsed}s`);
  console.log(`Total from API: ${total}`);
  console.log(`Sectors: ${sectors.length}`);
  console.log(`Job roles: ${jobRoles.length}`);
  console.log('First 5 sectors:', sectors.slice(0, 5).map(s => s.name));
  console.log('First 3 roles:', jobRoles.slice(0, 3).map(r => `${r.title} (${r.sectorName})`));

  const withSalary = jobRoles.find(r => r.salaryMin);
  if (withSalary) {
    console.log('\nSample role with salary:', withSalary.title, '$', withSalary.salaryMin, '-', withSalary.salaryMax);
  }

  // Show sector coverage
  const bySector = new Map<string, number>();
  for (const r of jobRoles) bySector.set(r.sectorName, (bySector.get(r.sectorName) ?? 0) + 1);
  console.log('\nSector coverage ('+bySector.size+'/35 sectors):');
  for (const [s, c] of [...bySector.entries()].sort((a, b) => b[1] - a[1])) {
    console.log('  '+s+':', c, 'roles');
  }
}

main().catch(console.error);
