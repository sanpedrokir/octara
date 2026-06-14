import https from 'https';
import crypto from 'crypto';
import fs from 'fs';

const agent = new https.Agent({ rejectUnauthorized: false });
const clientId = '2fdc268f224e4ee0b6bed673f90ce2d4';
const clientSecret = 'NWNjMzc2YTEtZjhiYi00NDA1LWFiM2UtNmEzMmQ1Zjk0M2U1';

// Try the decoded UUID form of the secret as well
const clientSecretDecoded = Buffer.from(clientSecret, 'base64').toString('utf8');
console.log('Client secret decoded:', clientSecretDecoded);

function apexL1(method, url, appId, appSecret, queryParams = {}) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const ts = Date.now();
  const params = {
    ...queryParams,
    apex_l1_eg_app_id: appId,
    apex_l1_eg_nonce: nonce,
    apex_l1_eg_signature_method: 'HMACSHA256',
    apex_l1_eg_timestamp: String(ts),
    apex_l1_eg_version: '1.0',
  };
  const sorted = Object.entries(params).sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const baseUrl = url.split('?')[0];
  const base = `${method.toUpperCase()}&${baseUrl}&${sorted}`;
  const sig = crypto.createHmac('sha256', appSecret).update(base).digest('base64');
  return `Apex_l1_eg realm="${baseUrl}",apex_l1_eg_app_id="${appId}",apex_l1_eg_nonce="${nonce}",apex_l1_eg_signature_method="HMACSHA256",apex_l1_eg_timestamp="${ts}",apex_l1_eg_version="1.0",apex_l1_eg_signature="${sig}"`;
}

function apexL2(method, url, appId, privateKey, queryParams = {}) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const ts = Date.now();
  const params = {
    ...queryParams,
    apex_l2_eg_app_id: appId,
    apex_l2_eg_nonce: nonce,
    apex_l2_eg_signature_method: 'SHA256withRSA',
    apex_l2_eg_timestamp: String(ts),
    apex_l2_eg_version: '1.0',
  };
  const sorted = Object.entries(params).sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const baseUrl = url.split('?')[0];
  const base = `${method.toUpperCase()}&${baseUrl}&${sorted}`;
  const sign = crypto.createSign('SHA256');
  sign.update(base);
  const sig = sign.sign({ key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING }, 'base64');
  return `Apex_l2_eg realm="${baseUrl}",apex_l2_eg_app_id="${appId}",apex_l2_eg_nonce="${nonce}",apex_l2_eg_signature_method="SHA256withRSA",apex_l2_eg_timestamp="${ts}",apex_l2_eg_version="1.0",apex_l2_eg_signature="${sig}"`;
}

const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

function req(host, path, headers) {
  return new Promise((resolve) => {
    const r = https.request(
      { hostname: host, port: 443, path, method: 'GET', agent, headers },
      res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d.slice(0, 200) }));
      }
    );
    r.setTimeout(10000, () => { r.destroy(); resolve({ status: 0, body: 'TIMEOUT' }); });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    r.end();
  });
}

// Get token
const tokenBody = `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;
const token = await new Promise((resolve) => {
  const r = https.request(
    { hostname: 'public-api.ssg-wsg.sg', port: 443, path: '/dp-oauth/oauth/token', method: 'POST', agent,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tokenBody), Authorization: `Basic ${basicAuth}` } },
    res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).access_token ?? null); } catch { resolve(null); } }); }
  );
  r.on('error', e => { console.log('Token error:', e.message); resolve(null); });
  r.write(tokenBody); r.end();
});
console.log('Token:', token ? '✅ ' + token.slice(0,20) + '...' : '❌ null');
if (!token) process.exit(1);

const testUrl = 'https://public-api.ssg-wsg.sg/skillsFramework/subsectors';
const host = 'public-api.ssg-wsg.sg';
const path = '/skillsFramework/subsectors';

console.log('\n--- Testing Apex L1 signing (HMAC with raw secret) ---');
const l1raw = apexL1('GET', testUrl, clientId, clientSecret);
const r1 = await req(host, path, { Accept: 'application/json', Authorization: `Bearer ${token}, ${l1raw}` });
console.log(`[${r1.status}] Bearer + L1(raw secret): ${r1.body}`);

console.log('\n--- Testing Apex L1 (HMAC with decoded UUID) ---');
const l1decoded = apexL1('GET', testUrl, clientId, clientSecretDecoded);
const r2 = await req(host, path, { Accept: 'application/json', Authorization: `Bearer ${token}, ${l1decoded}` });
console.log(`[${r2.status}] Bearer + L1(decoded UUID): ${r2.body}`);

console.log('\n--- Testing bearer only (baseline) ---');
const r3 = await req(host, path, { Accept: 'application/json', Authorization: `Bearer ${token}` });
console.log(`[${r3.status}] Bearer only: ${r3.body}`);

console.log('\n--- Testing no auth (public?) ---');
const r4 = await req(host, path, { Accept: 'application/json' });
console.log(`[${r4.status}] No auth: ${r4.body}`);

// Try L2 if private key exists
let privateKey = null;
try { privateKey = fs.readFileSync('ssg-private.key', 'utf8'); } catch {}
if (privateKey) {
  console.log('\n--- Testing Apex L2 signing (RSA with ssg-private.key) ---');
  try {
    const l2 = apexL2('GET', testUrl, clientId, privateKey);
    const r5 = await req(host, path, { Accept: 'application/json', Authorization: `Bearer ${token}, ${l2}` });
    console.log(`[${r5.status}] Bearer + L2: ${r5.body}`);
  } catch(e) { console.log('L2 sign error:', e.message); }
} else {
  console.log('\nNo ssg-private.key found, skipping L2 test.');
}

console.log('\n--- Testing course endpoint with L1 signing ---');
const courseUrl = 'https://api.ssg-wsg.sg/courses/courseDirectory/course?keyword=python&pageSize=1';
const courseHost = 'api.ssg-wsg.sg';
const coursePath = '/courses/courseDirectory/course?keyword=python&pageSize=1';
const l1course = apexL1('GET', courseUrl, clientId, clientSecret, { keyword: 'python', pageSize: '1' });
const r6 = await req(courseHost, coursePath, { Accept: 'application/json', Authorization: `Bearer ${token}, ${l1course}` });
console.log(`[${r6.status}] Course + L1 signed: ${r6.body}`);

const r7 = await req(courseHost, coursePath, { Accept: 'application/json', Authorization: `Bearer ${token}` });
console.log(`[${r7.status}] Course + Bearer only: ${r7.body}`);

console.log('\nDone.');
