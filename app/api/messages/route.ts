import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: '缺少 conversationId 参数' }, { status: 400 });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
