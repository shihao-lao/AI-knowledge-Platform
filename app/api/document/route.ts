import { NextRequest, NextResponse } from 'next/server';
import { documentService } from '@/lib/services/document-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const knowledgeId = searchParams.get('knowledgeId');

    if (!knowledgeId) {
      return NextResponse.json({ error: 'knowledgeId 参数不能为空' }, { status: 400 });
    }

    const docs = await documentService.list(knowledgeId);
    return NextResponse.json({ data: docs });
  } catch (err) {
    console.error('[Document API] list error:', err);
    return NextResponse.json({ error: '获取文档列表失败' }, { status: 500 });
  }
}
