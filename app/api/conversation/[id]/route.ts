import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/conversation/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

    return NextResponse.json({ data: conversation });
  } catch (err) {
    console.error('[Conversation API] GET error:', err);
    return NextResponse.json({ error: '获取对话失败' }, { status: 500 });
  }
}

// PUT /api/conversation/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title } = body;

    const conversation = await prisma.conversation.update({
      where: { id },
      data: { title },
    });

    return NextResponse.json({ data: conversation });
  } catch (err) {
    console.error('[Conversation API] PUT error:', err);
    return NextResponse.json({ error: '更新对话失败' }, { status: 500 });
  }
}

// DELETE /api/conversation/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error('[Conversation API] DELETE error:', err);
    return NextResponse.json({ error: '删除对话失败' }, { status: 500 });
  }
}
