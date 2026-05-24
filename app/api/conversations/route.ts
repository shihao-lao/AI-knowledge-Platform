import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kbId = searchParams.get('kbId');

    const where = kbId ? { knowledgeBaseId: kbId } : {};
    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { knowledgeBaseId, title } = body;

    if (!knowledgeBaseId) {
      return NextResponse.json({ error: '请指定知识库ID' }, { status: 400 });
    }

    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
    });

    if (!kb) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        knowledgeBaseId,
        title: title || `新对话 - ${new Date().toLocaleString('zh-CN')}`,
      },
    });

    await prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: {
        conversationCount: { increment: 1 },
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ message: '对话创建成功', conversation }, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
