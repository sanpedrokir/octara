import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });
const clientId = '2fdc268f224e4ee0b6bed673f90ce2d4';
const clientSecret = 'NWNjMzc2YTEtZjhiYi00NDA1LWFiM2UtNmEzMmQ1Zjk0M2U1';
const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

async function get(label, path, token) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'public-api.ssg-wsg.sg', port: 443,
      path, method: 'GET', agent,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const status = res.statusCode;
        const snippet = d.slice(0, 200);
        console.log(`[${status}] ${label}: ${snippet}`);
        resolve(status);
      });
    });
    req.on('error', e => { console.log(`[ERR] ${label}: ${e.message}`); resolve(0); });
    req.end();
  });
}

// Get token first
const tokenBody = `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;
const token = await new Promise((resolve) => {
  const opts = {
    hostname: 'public-api.ssg-wsg.sg', port: 443,
    path: '/dp-oauth/oauth/token', method: 'POST', agent,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tokenBody), Authorization: `Basic ${basicAuth}` }
  };
  const req = https.request(opts, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      const json = JSON.parse(d);
      console.log('Token:', json.access_token ? '✅ obtained' : '❌ failed');
      resolve(json.access_token ?? null);
    });
  });
  req.on('error', e => { console.log('Token error:', e.message); resolve(null); });
  req.write(tokenBody);
  req.end();
});

if (!token) { console.log('No token — aborting.'); process.exit(1); }

console.log('\n--- Skills Framework paths ---');
await get('subsectors', '/skillsFramework/subsectors', token);
await get('sectors',    '/skillsFramework/sectors', token);
await get('v1/subsectors', '/skillsFramework/v1/subsectors', token);
await get('v1/sectors',    '/skillsFramework/v1/sectors', token);
await get('tracks',     '/skillsFramework/tracks', token);
await get('jobRoles',   '/skillsFramework/jobRoleTitles', token);

console.log('\n--- Course Directory paths ---');
await get('courses v1', '/courses/courseDirectory/course?keyword=python&pageSize=1', token);
await get('courses v2', '/courses/v1/courseDirectory/course?keyword=python&pageSize=1', token);
await get('courses v3', '/courses/courseDirectory/v1/course?keyword=python&pageSize=1', token);
await get('courses v4', '/api/courses/courseDirectory/course?keyword=python&pageSize=1', token);

console.log('\nDone.');
