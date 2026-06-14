import https from 'https';
import http from 'http';
import { URL } from 'url';

// Shared agent that bypasses SSL verification for government APIs
// whose certificate chains may not be in Node.js's default trust store
const relaxedAgent = new https.Agent({ rejectUnauthorized: false });

export interface HttpResponse {
  status: number;
  ok: boolean;
  body: string;
}

export function httpsRequest(
  urlStr: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number } = {}
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
      agent: parsed.protocol === 'https:' ? relaxedAgent : undefined,
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          body: data,
        });
      });
    });

    req.on('error', reject);

    if (options.timeoutMs) {
      req.setTimeout(options.timeoutMs, () => {
        req.destroy(new Error(`Request timeout after ${options.timeoutMs}ms`));
      });
    }

    if (options.body) req.write(options.body);
    req.end();
  });
}

export async function httpsGetJson(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 15000
): Promise<{ status: number; ok: boolean; data: unknown; error?: string }> {
  try {
    const res = await httpsRequest(url, { method: 'GET', headers, timeoutMs });
    if (!res.ok) return { status: res.status, ok: false, data: null, error: res.body.slice(0, 200) };
    try {
      return { status: res.status, ok: true, data: JSON.parse(res.body) };
    } catch {
      return { status: res.status, ok: false, data: null, error: 'Invalid JSON response' };
    }
  } catch (e) {
    return { status: 0, ok: false, data: null, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function httpsPostForm(
  url: string,
  formData: Record<string, string>,
  timeoutMs = 10000,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; ok: boolean; data: unknown; error?: string }> {
  const body = new URLSearchParams(formData).toString();
  try {
    const res = await httpsRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(body)),
        ...extraHeaders,
      },
      body,
      timeoutMs,
    });
    if (!res.ok) return { status: res.status, ok: false, data: null, error: res.body.slice(0, 500) };
    try {
      return { status: res.status, ok: true, data: JSON.parse(res.body) };
    } catch {
      return { status: res.status, ok: false, data: null, error: 'Invalid JSON response' };
    }
  } catch (e) {
    return { status: 0, ok: false, data: null, error: e instanceof Error ? e.message : 'Network error' };
  }
}
