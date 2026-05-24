import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const knowledgeBases = await prisma.knowledgeBase.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ knowledgeBases });
  } catch (error) {
    console.error('Error fetching knowledge bases:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, visibility } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '知识库名称不能为空' }, { status: 400 });
    }

    const kb = await prisma.knowledgeBase.create({
      data: {
        name: name.trim(),
        description: description?.trim() || '',
        visibility: visibility || 'private',
      },
    });

    return NextResponse.json({ message: '创建成功', knowledgeBase: kb }, { status: 201 });
  } catch (error) {
    console.error('Error creating knowledge base:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
