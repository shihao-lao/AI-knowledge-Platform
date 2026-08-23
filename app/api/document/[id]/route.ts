import { NextRequest, NextResponse } from 'next/server';
import { documentService } from '@/lib/services/document-service';
import { requireUser, isKnowledgeOwnedBy, AuthError } from '@/lib/server/auth';

/** 文档归属校验：文档所属知识库必须属于当前用户 */
async function assertDocumentOwned(docId: string, userId: string): Promise<boolean> {
  const doc = await documentService.findById(docId);
  if (!doc) return false;
  return isKnowledgeOwnedBy(doc.knowledgeId, userId);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!(await assertDocumentOwned(id, user.id))) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }
    const doc = await documentService.findById(id);
    return NextResponse.json({ data: doc });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Document API] get error:', err);
    return NextResponse.json({ error: '获取文档失败' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled 字段必须为布尔值' }, { status: 400 });
    }

    if (!(await assertDocumentOwned(id, user.id))) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    const updated = await documentService.updateEnabled(id, enabled);
    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Document API] patch error:', err);
    return NextResponse.json({ error: '更新文档失败' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!(await assertDocumentOwned(id, user.id))) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }
    await documentService.delete(id, user.id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Document API] delete error:', err);
    return NextResponse.json({ error: '删除文档失败' }, { status: 500 });
  }
}
