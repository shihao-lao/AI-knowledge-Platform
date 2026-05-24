import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在或密码错误' }, { status: 401 });
    }

    return NextResponse.json({
      message: '登录成功',
      user,
      token: `mock_token_${user.id}_${Date.now()}`,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
