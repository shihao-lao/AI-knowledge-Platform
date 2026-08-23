import { NextRequest, NextResponse } from 'next/server';
import { practiceService } from '@/lib/server/practice-service';
import { requireUser, isKnowledgeOwnedBy, AuthError } from '@/lib/server/auth';

// GET /api/practice/stats?knowledgeId=xxx
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const knowledgeId = searchParams.get('knowledgeId');
    if (!knowledgeId) {
      return NextResponse.json({ error: 'knowledgeId 不能为空' }, { status: 400 });
    }
    if (!(await isKnowledgeOwnedBy(knowledgeId, user.id))) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    const stats = await practiceService.stats(knowledgeId);
    return NextResponse.json({ data: stats });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Practice API] stats error:', err);
    return NextResponse.json({ error: '获取练习统计失败' }, { status: 500 });
  }
}
