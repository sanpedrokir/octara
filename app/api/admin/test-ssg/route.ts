import { getCurrentUser } from '@/lib/auth';
import { ssgGetDiag } from '@/lib/ssg-skills-api';
import { getAccessTokenDiag, getAccessToken } from '@/lib/ssg-api-auth';
import { httpsGetJson } from '@/lib/https-request';
import { apexHeaders } from '@/lib/apex-sign';

const SKILL_PATHS = [
  '/skillsFramework/jobRoles?pageNo=0&pageSize=3',
  '/skillsFramework/occupations',
  '/skillsFramework/subsectors',
];

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return Response.json({ data: null, error: 'Admin access required' }, { status: 403 });
    }

    const tokenResult = await getAccessTokenDiag();
    const skillResults: Record<string, { status: number; ok: boolean; snippet: string; error?: string }> = {};

    if (tokenResult.token) {
      // Test with skillsFramework scope (the scope that unlocks these endpoints)
      const sfToken = await getAccessToken('skillsFramework');
      const headers = { Accept: 'application/json', Authorization: `Bearer ${sfToken ?? tokenResult.token}` };

      for (const path of SKILL_PATHS) {
        const r = await ssgGetDiag(path);
        const key = `public-api.ssg-wsg.sg${path.split('?')[0]}`;
        skillResults[key] = {
          status: r.status,
          ok: r.ok,
          snippet: r.ok ? JSON.stringify(r.body).slice(0, 200) : '',
          error: r.error,
        };
      }

      // Test Course Directory — with Apex signing
      const clientId = process.env.SSG_CLIENT_ID ?? '';
      const clientSecret = process.env.SSG_CLIENT_SECRET ?? '';
      const courseUrl = 'https://api.ssg-wsg.sg/courses/courseDirectory/course?keyword=python&pageSize=1';
      const apexHdrs = apexHeaders('GET', courseUrl, sfToken ?? tokenResult.token, clientId, clientSecret, { keyword: 'python', pageSize: '1' });
      const cr = await httpsGetJson(courseUrl, apexHdrs, 10000);
      skillResults['api.ssg-wsg.sg/courses/courseDirectory/course'] = {
        status: cr.status,
        ok: cr.ok,
        snippet: cr.ok ? JSON.stringify(cr.data).slice(0, 500) : JSON.stringify(cr.data ?? '').slice(0, 500),
        error: cr.error,
      };
    }

    return Response.json({
      data: {
        hasCredentials: !!(process.env.SSG_CLIENT_ID && process.env.SSG_CLIENT_SECRET),
        hasToken: !!tokenResult.token,
        tokenStatus: tokenResult.status,
        tokenError: tokenResult.error,
        skillResults,
      },
      error: null,
    });
  } catch (err) {
    return Response.json({ data: null, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
