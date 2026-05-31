import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/conversation/[id]/message
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      data: messages.map((m) => ({
        ...m,
        citations: JSON.parse(m.citations || '[]'),
      })),
    });
  } catch (err) {
    console.error('[Message API] GET error:', err);
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 });
  }
}

// POST /api/conversation/[id]/message
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { role, content, citations } = body;

    if (!role || !content) {
      return NextResponse.json({ error: 'role and content are required' }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        conversationId: id,
        role,
        content,
        citations: JSON.stringify(citations || []),
      },
    });

    // 更新对话的消息计数和更新时间
    await prisma.conversation.update({
      where: { id },
      data: {
        messageCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        ...message,
        citations: JSON.parse(message.citations || '[]'),
      },
    });
  } catch (err) {
    console.error('[Message API] POST error:', err);
    return NextResponse.json({ error: '保存消息失败' }, { status: 500 });
  }
}
