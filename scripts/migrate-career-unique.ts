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

  const dupes = await sql`SELECT user_id, COUNT(*) FROM career_aspirations GROUP BY user_id HAVING COUNT(*) > 1`;
  if (dupes.length > 0) {
    console.log(`Found ${dupes.length} user(s) with duplicate career entries. Cleaning up…`);
    await sql`
      DELETE FROM career_aspirations
      WHERE id NOT IN (
        SELECT MAX(id) FROM career_aspirations GROUP BY user_id
      )
    `;
    console.log('✅ Duplicates removed');
  } else {
    console.log('✅ No duplicates found');
  }

  const exists = await sql`
    SELECT 1 FROM pg_constraint
    WHERE conname = 'career_aspirations_user_id_key'
      AND conrelid = 'career_aspirations'::regclass
  `;
  if (exists.length === 0) {
    await sql`ALTER TABLE career_aspirations ADD CONSTRAINT career_aspirations_user_id_key UNIQUE (user_id)`;
    console.log('✅ Unique constraint added');
  } else {
    console.log('✅ Unique constraint already exists');
  }

  process.exit(0);
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
