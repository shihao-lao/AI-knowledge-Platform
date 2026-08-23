/**
 * 会话令牌：HMAC-SHA256 签名的 `{ uid, exp }`，base64url 编码。
 * 使用 Web Crypto 实现，Node.js（Route Handler）与 Edge（middleware）均可运行，
 * 保证两端的签名/验签逻辑完全一致。
 */
export const COOKIE_NAME = 'auth_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  const env = process.env.AUTH_SECRET;
  if (env && env.length >= 16) {
    cachedSecret = env;
    return env;
  }
  // 开发降级：进程级随机密钥（重启后所有会话失效），生产环境必须配置 AUTH_SECRET
  console.warn('[Auth] AUTH_SECRET 未设置或过短，正在使用进程级临时密钥（重启后登录态失效）');
  cachedSecret = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  return cachedSecret;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

export interface SessionPayload {
  uid: string;
  exp: number;
}

export async function createSessionToken(userId: string): Promise<string> {
  const payload: SessionPayload = { uid: userId, exp: Date.now() + SESSION_TTL_MS };
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey('sign'), new TextEncoder().encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey('verify'),
      base64UrlToBytes(sig),
      new TextEncoder().encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as SessionPayload;
    if (typeof payload.uid !== 'string' || typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
