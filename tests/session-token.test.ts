import { describe, it, expect, beforeAll } from 'vitest';
import { createSessionToken, verifySessionToken } from '@/lib/shared/session-token';

describe('session-token 会话令牌', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = 'test-secret-0123456789-abcdefghijklmnop';
  });

  it('签发与验证往返成功', async () => {
    const token = await createSessionToken('u_test');
    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.uid).toBe('u_test');
    expect(payload!.exp).toBeGreaterThan(Date.now());
  });

  it('篡改令牌验证失败', async () => {
    const token = await createSessionToken('u_test');
    const tampered = token.slice(0, -3) + 'xyz';
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it('过期令牌验证失败', async () => {
    // 手工构造过期 payload（exp 在过去）
    const body = Buffer.from(JSON.stringify({ uid: 'u_test', exp: Date.now() - 1000 })).toString('base64url');
    const crypto = globalThis.crypto;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(process.env.AUTH_SECRET!),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const sigB64 = Buffer.from(sig).toString('base64url');
    const expired = `${body}.${sigB64}`;
    expect(await verifySessionToken(expired)).toBeNull();
  });

  it('格式错误返回 null', async () => {
    expect(await verifySessionToken('not-a-token')).toBeNull();
    expect(await verifySessionToken('')).toBeNull();
  });
});
