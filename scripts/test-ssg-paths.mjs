import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });
const clientId = '2fdc268f224e4ee0b6bed673f90ce2d4';
const clientSecret = 'NWNjMzc2YTEtZjhiYi00NDA1LWFiM2UtNmEzMmQ1Zjk0M2U1';
const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

function get(host, path, token) {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: host, port: 443, path, method: 'GET', agent,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
      res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          console.log(`[${res.statusCode}] ${host}${path}  →  ${d.slice(0, 100)}`);
          resolve(res.statusCode);
        });
      }
    );
    req.setTimeout(8000, () => { req.destroy(); console.log(`[TMO] ${host}${path}`); resolve(0); });
    req.on('error', e => { console.log(`[ERR] ${host}${path}  →  ${e.message}`); resolve(0); });
    req.end();
  });
}

// Get token
const tokenBody = `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;
const token = await new Promise((resolve) => {
  const req = https.request(
    { hostname: 'public-api.ssg-wsg.sg', port: 443, path: '/dp-oauth/oauth/token', method: 'POST', agent,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(tokenBody), Authorization: `Basic ${basicAuth}` } },
    res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d).access_token ?? null)); }
  );
  req.on('error', e => { console.log('Token error:', e.message); resolve(null); });
  req.write(tokenBody); req.end();
});
console.log('Token:', token ? '✅' : '❌'); if (!token) process.exit(1);

const tests = [
  // Courses on api.ssg-wsg.sg
  ['api.ssg-wsg.sg', '/courses/courseDirectory/course?keyword=python&pageSize=1'],
  ['api.ssg-wsg.sg', '/courses/v1/courseDirectory/course?keyword=python&pageSize=1'],
  // Courses on public-api — try tpg path (Training Provider Gateway)
  ['public-api.ssg-wsg.sg', '/tpg/courses/courseDirectory/course?keyword=python&pageSize=1'],
  ['public-api.ssg-wsg.sg', '/sf/courses/courseDirectory/course?keyword=python&pageSize=1'],
  // Skills Framework on api.ssg-wsg.sg
  ['api.ssg-wsg.sg', '/skillsFramework/sectors'],
  ['api.ssg-wsg.sg', '/skillsFramework/subsectors'],
  // Check what's at root of public-api
  ['public-api.ssg-wsg.sg', '/'],
  ['public-api.ssg-wsg.sg', '/api'],
];

for (const [host, path] of tests) {
  const status = await get(host, path, token);
  if (status !== 404 && status !== 0) console.log('  ^^^ NON-404 ^^^');
}
console.log('Done.');
