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
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type VARCHAR(30)`;
  console.log('✅ user_type column ready');
  process.exit(0);
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
