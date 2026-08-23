import { NextRequest, NextResponse } from 'next/server';
import { questionService } from '@/lib/services/question-service';
import { requireUser, AuthError } from '@/lib/server/auth';

// DELETE /api/question/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const deleted = await questionService.delete(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 });
    }
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Question API] delete error:', err);
    return NextResponse.json({ error: '删除题目失败' }, { status: 500 });
  }
}
