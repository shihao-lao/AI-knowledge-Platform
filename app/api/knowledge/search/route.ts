import { NextRequest, NextResponse } from 'next/server';
import { getEmbeddingProvider } from '@/lib/embedding';
import { searchKnowledge } from '@/lib/lancedb/search';
import { ensureTable } from '@/lib/lancedb/client';
import { chunkRepo, documentRepo } from '@/lib/db/knowledge-repository';
import { requireUser, isKnowledgeOwnedBy, AuthError } from '@/lib/server/auth';

const ID_PATTERN = /^[A-Za-z0-9_]+$/;

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { query, knowledgeId, topK, scoreThreshold, metadataFilter } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: '查询内容不能为空' }, { status: 400 });
    }
    if (query.length > 2000) {
      return NextResponse.json({ error: '查询内容过长' }, { status: 400 });
    }
    if (knowledgeId !== undefined && (typeof knowledgeId !== 'string' || !ID_PATTERN.test(knowledgeId))) {
      return NextResponse.json({ error: 'knowledgeId 格式不合法' }, { status: 400 });
    }

    // 归属校验：只允许检索自己名下的知识库
    if (knowledgeId && !(await isKnowledgeOwnedBy(knowledgeId, user.id))) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    const embeddings = await getEmbeddingProvider();
    await ensureTable();

    // 查询已禁用的文档 ID，排除其切片
    let excludeDocumentIds: string[] = [];
    if (knowledgeId) {
      const docs = await documentRepo.list(knowledgeId);
      excludeDocumentIds = docs.filter((d) => !d.enabled).map((d) => d.id);
    }

    const results = await searchKnowledge(embeddings, {
      query: query.trim(),
      userId: user.id,
      knowledgeId: knowledgeId || undefined,
      topK: Math.min(topK ?? 8, 20),
      ...(scoreThreshold != null && { scoreThreshold }),
      metadataFilter: metadataFilter || undefined,
      excludeDocumentIds,
    });

    const chunks = await chunkRepo.listByIds(results.map((r) => r.chunkId).filter(Boolean));
    const chunkIndexById = new Map(chunks.map((chunk) => [chunk.id, chunk.chunkIndex]));

    return NextResponse.json({
      chunks: results.map((r) => ({
        content: r.content,
        score: r.score,
        source: r.filename,
        chunkId: r.chunkId,
        chunkIndex: chunkIndexById.get(r.chunkId) ?? r.chunkIndex,
        documentId: r.documentId,
        knowledgeId: r.knowledgeId,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('[Search API] error:', err);
    return NextResponse.json({ error: '知识搜索失败' }, { status: 500 });
  }
}
