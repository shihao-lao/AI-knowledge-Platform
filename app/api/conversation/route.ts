import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireUser, isKnowledgeOwnedBy, AuthError } from '@/lib/server/auth';

// GET /api/conversation?knowledgeId=xxx
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const knowledgeId = searchParams.get('knowledgeId');

    if (!knowledgeId) {
      return NextResponse.json({ error: 'knowledgeId is required' }, { status: 400 });
    }
    if (!(await isKnowledgeOwnedBy(knowledgeId, user.id))) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
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
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: '获取对话列表失败', details: msg }, { status: 500 });
  }
}

// POST /api/conversation
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { knowledgeId, title } = body;

    if (!knowledgeId) {
      return NextResponse.json({ error: 'knowledgeId is required' }, { status: 400 });
    }
    if (!(await isKnowledgeOwnedBy(knowledgeId, user.id))) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        id: `conv_${crypto.randomUUID()}`,
        knowledgeId,
        title: title || '新对话',
      },
    });

    return NextResponse.json({ data: conversation });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json({ error: '创建对话失败', details: msg }, { status: 500 });
  }
}
