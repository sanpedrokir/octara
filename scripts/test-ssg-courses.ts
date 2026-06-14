import { getAccessToken, getAccessTokenDiag } from '../lib/ssg-api-auth';
import { httpsGetJson } from '../lib/https-request';
import { apexHeaders } from '../lib/apex-sign';

async function main() {
  console.log('\n=== SSG Course Directory Diagnostic ===\n');

  // 1. Token
  const tokenResult = await getAccessTokenDiag();
  console.log('OAuth token status:', tokenResult.status);
  console.log('Has token:', !!tokenResult.token);
  if (tokenResult.error) console.log('Token error:', tokenResult.error);

  const clientId = process.env.SSG_CLIENT_ID ?? '';
  const clientSecret = process.env.SSG_CLIENT_SECRET ?? '';

  // 2. Try Course Directory with Apex + Bearer
  const keyword = 'python';
  const url = `https://api.ssg-wsg.sg/courses/courseDirectory/course?keyword=${encodeURIComponent(keyword)}&page=0&pageSize=3`;
  const hdrs = apexHeaders('GET', url, tokenResult.token, clientId, clientSecret, { keyword, page: '0', pageSize: '3' });

  console.log('\n--- Course Directory (Apex + Bearer) ---');
  console.log('URL:', url);
  const r1 = await httpsGetJson(url, hdrs, 15000);
  console.log('Status:', r1.status, '| OK:', r1.ok);
  console.log('Response:', JSON.stringify(r1.data ?? r1.error).slice(0, 600));

  // 3. Try without Apex (Bearer only)
  const hdrs2: Record<string, string> = { Accept: 'application/json' };
  if (tokenResult.token) hdrs2['Authorization'] = `Bearer ${tokenResult.token}`;

  console.log('\n--- Course Directory (Bearer only, no Apex) ---');
  const r2 = await httpsGetJson(url, hdrs2, 15000);
  console.log('Status:', r2.status, '| OK:', r2.ok);
  console.log('Response:', JSON.stringify(r2.data ?? r2.error).slice(0, 600));

  // 4. Try no auth at all
  console.log('\n--- Course Directory (no auth) ---');
  const r3 = await httpsGetJson(url, { Accept: 'application/json' }, 15000);
  console.log('Status:', r3.status, '| OK:', r3.ok);
  console.log('Response:', JSON.stringify(r3.data ?? r3.error).slice(0, 600));

  // 5. Try the public myskillsfuture search API (no auth needed)
  console.log('\n--- SkillsFuture public search API ---');
  const pubUrl = `https://api.myskillsfuture.gov.sg/individual/course-directory/course-detail.html?keyword=${encodeURIComponent(keyword)}&pageSize=3&pageIndex=0`;
  const r4 = await httpsGetJson(pubUrl, { Accept: 'application/json' }, 15000);
  console.log('Status:', r4.status, '| OK:', r4.ok);
  console.log('Response:', JSON.stringify(r4.data ?? r4.error).slice(0, 600));
}

main().catch(e => { console.error(e); process.exit(1); });
