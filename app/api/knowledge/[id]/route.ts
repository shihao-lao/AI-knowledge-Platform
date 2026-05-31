import { NextRequest, NextResponse } from 'next/server';
import { knowledgeService } from '@/lib/services/knowledge-service';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const kb = await knowledgeService.findById(id);
    if (!kb) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }
    return NextResponse.json({ data: kb });
  } catch (err) {
    console.error('[Knowledge API] get error:', err);
    return NextResponse.json({ error: '获取知识库失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, visibility } = body;

    const existing = await knowledgeService.findById(id);
    if (!existing) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    const patch: Record<string, string> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: '知识库名称不能为空' }, { status: 400 });
      }
      patch.name = name.trim().slice(0, 200);
    }
    if (description !== undefined) {
      patch.description = String(description).slice(0, 1000);
    }
    if (visibility !== undefined) {
      patch.visibility = visibility === 'public' ? 'public' : 'private';
    }

    const updated = await knowledgeService.update(id, patch);
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[Knowledge API] update error:', err);
    return NextResponse.json({ error: '更新知识库失败' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await knowledgeService.findById(id);
    if (!existing) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }
    await knowledgeService.delete(id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error('[Knowledge API] delete error:', err);
    return NextResponse.json({ error: '删除知识库失败' }, { status: 500 });
  }
}
