import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createUser } from '@/lib/store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 });
    }

    const existingUser = getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 });
    }

    const user = createUser({
      name: body.name || email.split('@')[0],
      email,
      role: 'editor',
    });

    return NextResponse.json(
      {
        message: '注册成功',
        user,
        token: `mock_token_${user.id}_${Date.now()}`,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
