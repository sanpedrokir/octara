import { httpsPostForm } from './https-request';

const SSG_TOKEN_URL = 'https://public-api.ssg-wsg.sg/dp-oauth/oauth/token';

interface TokenCache { token: string; expiry: number }
const _tokenCache = new Map<string, TokenCache>();

async function fetchToken(
  clientId: string,
  clientSecret: string,
  scope?: string
): Promise<{ token: string | null; status: number; error?: string }> {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const formData: Record<string, string> = {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  };
  if (scope) formData.scope = scope;

  // SSG requires credentials in BOTH Authorization header AND request body
  const result = await httpsPostForm(SSG_TOKEN_URL, formData, 10000, {
    Authorization: `Basic ${basicAuth}`,
  });

  if (result.ok && (result.data as Record<string, unknown>)?.access_token) {
    return { token: String((result.data as Record<string, unknown>).access_token), status: result.status };
  }

  return {
    token: null,
    status: result.status,
    error: result.error ?? (result.data ? JSON.stringify(result.data).slice(0, 200) : `HTTP ${result.status}`),
  };
}

export async function getAccessToken(scope?: string): Promise<string | null> {
  const clientId = process.env.SSG_CLIENT_ID;
  const clientSecret = process.env.SSG_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const key = scope ?? '_default';
  const cached = _tokenCache.get(key);
  if (cached && Date.now() < cached.expiry) return cached.token;

  const result = await fetchToken(clientId, clientSecret, scope);
  if (result.token) {
    _tokenCache.set(key, { token: result.token, expiry: Date.now() + 55 * 60 * 1000 });
  }
  return result.token;
}

export async function getAccessTokenDiag(): Promise<{ token: string | null; error?: string; status: number }> {
  const clientId = process.env.SSG_CLIENT_ID;
  const clientSecret = process.env.SSG_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { token: null, error: 'SSG_CLIENT_ID or SSG_CLIENT_SECRET not set in .env.local', status: 0 };
  }

  const cached = _tokenCache.get('_default');
  if (cached && Date.now() < cached.expiry) return { token: cached.token, status: 200 };

  const result = await fetchToken(clientId, clientSecret);
  if (result.token) {
    _tokenCache.set('_default', { token: result.token, expiry: Date.now() + 55 * 60 * 1000 });
  }
  return { token: result.token, status: result.status, error: result.error };
}
