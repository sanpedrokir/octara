import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Apex L1 signing (HMAC-SHA256) uses client secret as key
// Apex L2 signing (SHA256withRSA) uses private key file
// SSG Skills Framework and Course APIs require one of these

function buildBaseString(
  method: string,
  urlStr: string,
  appId: string,
  nonce: string,
  timestamp: number,
  level: 'l1' | 'l2',
  queryParams: Record<string, string> = {}
): string {
  const sigMethod = level === 'l1' ? 'HMACSHA256' : 'SHA256withRSA';
  const prefix = level === 'l1' ? 'apex_l1_eg' : 'apex_l2_eg';

  const sigParams: Record<string, string> = {
    ...queryParams,
    [`${prefix}_app_id`]: appId,
    [`${prefix}_nonce`]: nonce,
    [`${prefix}_signature_method`]: sigMethod,
    [`${prefix}_timestamp`]: String(timestamp),
    [`${prefix}_version`]: '1.0',
  };

  const sortedParams = Object.entries(sigParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // Strip query string from URL for the base string
  const baseUrl = urlStr.split('?')[0];
  return `${method.toUpperCase()}&${baseUrl}&${sortedParams}`;
}

export function apexL1Header(
  method: string,
  urlStr: string,
  appId: string,
  appSecret: string,
  queryParams: Record<string, string> = {}
): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const baseString = buildBaseString(method, urlStr, appId, nonce, timestamp, 'l1', queryParams);

  const sig = crypto.createHmac('sha256', appSecret).update(baseString).digest('base64');

  return `Apex_l1_eg realm="${urlStr}",apex_l1_eg_app_id="${appId}",apex_l1_eg_nonce="${nonce}",apex_l1_eg_signature_method="HMACSHA256",apex_l1_eg_timestamp="${timestamp}",apex_l1_eg_version="1.0",apex_l1_eg_signature="${sig}"`;
}

let _privateKey: string | null = null;

function loadPrivateKey(): string | null {
  if (_privateKey) return _privateKey;
  try {
    const keyPath = path.join(process.cwd(), 'ssg-private.key');
    _privateKey = fs.readFileSync(keyPath, 'utf8');
    return _privateKey;
  } catch {
    return null;
  }
}

export function apexL2Header(
  method: string,
  urlStr: string,
  appId: string,
  queryParams: Record<string, string> = {}
): string | null {
  const privateKey = loadPrivateKey();
  if (!privateKey) return null;

  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const baseString = buildBaseString(method, urlStr, appId, nonce, timestamp, 'l2', queryParams);

  try {
    const sign = crypto.createSign('SHA256');
    sign.update(baseString);
    const sig = sign.sign({ key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING }, 'base64');

    return `Apex_l2_eg realm="${urlStr}",apex_l2_eg_app_id="${appId}",apex_l2_eg_nonce="${nonce}",apex_l2_eg_signature_method="SHA256withRSA",apex_l2_eg_timestamp="${timestamp}",apex_l2_eg_version="1.0",apex_l2_eg_signature="${sig}"`;
  } catch {
    return null;
  }
}

// Returns headers with both Bearer token and Apex signature
export function apexHeaders(
  method: string,
  urlStr: string,
  bearerToken: string | null,
  clientId: string,
  clientSecret: string,
  queryParams: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  // Try L2 first (RSA), fall back to L1 (HMAC)
  const l2 = apexL2Header(method, urlStr, clientId, queryParams);
  const apexSig = l2 ?? apexL1Header(method, urlStr, clientId, clientSecret, queryParams);

  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}, ${apexSig}`;
  } else {
    headers['Authorization'] = apexSig;
  }

  return headers;
}
