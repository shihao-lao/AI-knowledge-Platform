import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/conversation?knowledgeId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const knowledgeId = searchParams.get('knowledgeId');

    if (!knowledgeId) {
      return NextResponse.json({ error: 'knowledgeId is required' }, { status: 400 });
    }

    const conversations = await prisma.conversation.findMany({
      where: { knowledgeId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({
      data: conversations.map((c) => ({
        ...c,
        messageCount: c._count.messages,
      })),
    });
  } catch (err: any) {
    console.error('[Conversation API] GET error:', err);
    return NextResponse.json({ error: '获取对话列表失败', details: err.message }, { status: 500 });
  }
}

// POST /api/conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { knowledgeId, title } = body;

    if (!knowledgeId) {
      return NextResponse.json({ error: 'knowledgeId is required' }, { status: 400 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        knowledgeId,
        title: title || '新对话',
      },
    });

    return NextResponse.json({ data: conversation });
  } catch (err: any) {
    console.error('[Conversation API] POST error:', err);
    return NextResponse.json({ error: '创建对话失败', details: err.message }, { status: 500 });
  }
}
