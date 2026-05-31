import { NextRequest, NextResponse } from 'next/server';
import { documentService } from '@/lib/services/document-service';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const doc = await documentService.findById(id);
    if (!doc) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }
    return NextResponse.json({ data: doc });
  } catch (err) {
    console.error('[Document API] get error:', err);
    return NextResponse.json({ error: '获取文档失败' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await documentService.findById(id);
    if (!existing) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }
    await documentService.delete(id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error('[Document API] delete error:', err);
    return NextResponse.json({ error: '删除文档失败' }, { status: 500 });
  }
}
