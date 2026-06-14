import { readFileSync } from 'fs';
import path from 'path';

const env = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
for (const line of env.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) process.env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
}

import bcrypt from 'bcryptjs';
import { db } from '../lib/db';

const ADMIN_EMAIL = 'alex@octara.sg';
const ADMIN_NAME = 'Alex';
const ADMIN_PASSWORD = 'P12345678';

async function main() {
  const sql = db();

  const existing = await sql`SELECT id, role FROM users WHERE email = ${ADMIN_EMAIL}`;
  if (existing.length > 0) {
    const u = existing[0];
    if (u.role === 'admin') {
      console.log(`Admin already exists: ${ADMIN_EMAIL} (id=${u.id})`);
    } else {
      await sql`UPDATE users SET role = 'admin' WHERE id = ${u.id as number}`;
      console.log(`Updated existing user to admin: ${ADMIN_EMAIL} (id=${u.id})`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const [user] = await sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (${ADMIN_NAME}, ${ADMIN_EMAIL}, ${passwordHash}, 'admin')
    RETURNING id, email, name, role
  `;
  await sql`INSERT INTO profiles (user_id) VALUES (${user.id as number}) ON CONFLICT (user_id) DO NOTHING`;

  console.log(`✅ Admin created: ${user.email} (id=${user.id})`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
