import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword, createSession } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: '请输入邮箱和密码' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // 用户不存在与密码错误统一返回同一提示，避免枚举邮箱
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    await createSession(user.id);

    return NextResponse.json({ data: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('[Auth] login error:', err);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
