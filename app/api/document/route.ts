import { NextRequest, NextResponse } from 'next/server';
import { documentService } from '@/lib/services/document-service';
import { requireUser, isKnowledgeOwnedBy, AuthError } from '@/lib/server/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const knowledgeId = searchParams.get('knowledgeId');

    if (!knowledgeId) {
      return NextResponse.json({ error: 'knowledgeId 参数不能为空' }, { status: 400 });
    }
    if (!(await isKnowledgeOwnedBy(knowledgeId, user.id))) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    const docs = await documentService.list(knowledgeId);
    return NextResponse.json({ data: docs });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Document API] list error:', err);
    return NextResponse.json({ error: '获取文档列表失败' }, { status: 500 });
  }
}
