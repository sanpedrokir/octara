import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dir, '..', '.env.local'), 'utf-8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();

const client = new Client({ connectionString: url });
await client.connect();
const res = await client.query('SELECT id, name, email, role FROM users ORDER BY id');
console.table(res.rows);
await client.end();
