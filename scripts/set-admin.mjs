import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const envContent = readFileSync(join(__dir, '..', '.env.local'), 'utf-8');
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = match[1].trim();

const email = process.argv[2] || 'test@edusorax.com';

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();
const res = await client.query(
  "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role",
  [email]
);
if (res.rows.length === 0) {
  console.log(`No user found with email: ${email}`);
} else {
  console.log('Admin role set:', res.rows[0]);
}
await client.end();
