import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst();
    return NextResponse.json({
      user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
