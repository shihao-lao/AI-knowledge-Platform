import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeBaseById, updateKnowledgeBase, deleteKnowledgeBase } from '@/lib/store';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const kb = getKnowledgeBaseById(id);
    if (!kb) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }
    return NextResponse.json({ knowledgeBase: kb });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const kb = updateKnowledgeBase(id, body);
    if (!kb) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    return NextResponse.json({ message: '更新成功', knowledgeBase: kb });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = deleteKnowledgeBase(id);
    if (!success) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
