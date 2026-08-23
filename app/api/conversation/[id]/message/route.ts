import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireUser, isConversationOwnedBy, AuthError } from '@/lib/server/auth';

// GET /api/conversation/[id]/message
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    if (!(await isConversationOwnedBy(id, user.id))) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

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
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Message API] GET error:', err);
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 });
  }
}

// POST /api/conversation/[id]/message
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const { role, content, citations } = body;

    if (!role || !content) {
      return NextResponse.json({ error: 'role and content are required' }, { status: 400 });
    }
    if (!(await isConversationOwnedBy(id, user.id))) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
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
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Message API] POST error:', err);
    return NextResponse.json({ error: '保存消息失败' }, { status: 500 });
  }
}
