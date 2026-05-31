import { NextRequest, NextResponse } from 'next/server';
import { knowledgeService } from '@/lib/services/knowledge-service';

export async function GET() {
  try {
    const list = await knowledgeService.list();
    return NextResponse.json({ data: list });
  } catch (err) {
    console.error('[Knowledge API] list error:', err);
    return NextResponse.json({ error: '获取知识库列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, visibility } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '知识库名称不能为空' }, { status: 400 });
    }
    if (name.length > 200) {
      return NextResponse.json({ error: '知识库名称不能超过200个字符' }, { status: 400 });
    }

    const kb = await knowledgeService.create({
      name: name.trim(),
      description: description?.slice(0, 1000) ?? '',
      visibility: visibility === 'public' ? 'public' : 'private',
    });

    return NextResponse.json({ data: kb }, { status: 201 });
  } catch (err) {
    console.error('[Knowledge API] create error:', err);
    return NextResponse.json({ error: '创建知识库失败' }, { status: 500 });
  }
}
