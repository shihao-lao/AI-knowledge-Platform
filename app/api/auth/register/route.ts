import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword, createSession } from '@/lib/server/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!name || name.length > 50) {
      return NextResponse.json({ error: '昵称不能为空且不超过 50 字符' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: '密码长度需在 8-128 字符之间' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
    }

    const id = `u_${crypto.randomUUID().slice(0, 8)}`;
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { id, name, email, passwordHash } });
    await createSession(user.id);

    return NextResponse.json(
      { data: { id: user.id, name: user.name, email: user.email } },
      { status: 201 },
    );
  } catch (err) {
    console.error('[Auth] register error:', err);
    return NextResponse.json({ error: '注册失败' }, { status: 500 });
  }
}
