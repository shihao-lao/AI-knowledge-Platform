import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeBases, createKnowledgeBase } from '@/lib/store';

export async function GET() {
  try {
    const knowledgeBases = getKnowledgeBases();
    return NextResponse.json({ knowledgeBases });
  } catch (error) {
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

    const kb = createKnowledgeBase({
      name: name.trim(),
      description: description?.trim() || '',
      visibility: visibility || 'private',
    });

    return NextResponse.json({ message: '创建成功', knowledgeBase: kb }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
