import { NextRequest, NextResponse } from 'next/server';
import { getDocumentById, updateDocument, deleteDocument } from '@/lib/store';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const doc = getDocumentById(id);
    if (!doc) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }
    return NextResponse.json({ document: doc });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = deleteDocument(id);
    if (!success) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
