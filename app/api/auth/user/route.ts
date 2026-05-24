import { NextResponse } from 'next/server';
import { getUsers } from '@/lib/store';

export async function GET() {
  try {
    const users = getUsers();
    return NextResponse.json({
      user: users[0] || null,
    });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
