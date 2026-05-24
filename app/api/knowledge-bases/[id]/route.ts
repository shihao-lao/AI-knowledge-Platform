import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        _count: {
          select: { documents: true, conversations: true },
        },
      },
    });
    if (!kb) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }
    return NextResponse.json({ knowledgeBase: kb });
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const kb = await prisma.knowledgeBase.update({
      where: { id },
      data: body,
    });
    if (!kb) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    return NextResponse.json({ message: '更新成功', knowledgeBase: kb });
  } catch (error) {
    console.error('Error updating knowledge base:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const kb = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    await prisma.knowledgeBase.delete({ where: { id } });

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
