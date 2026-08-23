import 'server-only';
import { cookies } from 'next/headers';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { COOKIE_NAME, createSessionToken, verifySessionToken } from '@/lib/shared/session-token';

export class AuthError extends Error {}

// ==================== 密码哈希（scrypt + 随机盐） ====================

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// ==================== 会话 ====================

export async function createSession(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email };
}

/** 要求登录；未登录抛出 AuthError，由调用方转换为 401 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError('未登录或会话已过期');
  return user;
}

/** 校验知识库是否属于当前用户（资源归属校验的核心入口） */
export async function isKnowledgeOwnedBy(knowledgeId: string, userId: string): Promise<boolean> {
  if (!knowledgeId || !userId) return false;
  const kb = await prisma.knowledge.findFirst({ where: { id: knowledgeId, userId }, select: { id: true } });
  return kb !== null;
}

/** 校验对话是否属于当前用户（通过其所属知识库间接判断） */
export async function isConversationOwnedBy(conversationId: string, userId: string): Promise<boolean> {
  if (!conversationId || !userId) return false;
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, knowledge: { userId } },
    select: { id: true },
  });
  return conv !== null;
}
