import { NextRequest, NextResponse } from 'next/server';
import { getEmbeddingProvider } from '@/lib/embedding';
import { searchKnowledge } from '@/lib/lancedb/search';
import { ensureTable } from '@/lib/lancedb/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, knowledgeId, topK, scoreThreshold, metadataFilter } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: '查询内容不能为空' }, { status: 400 });
    }
    if (query.length > 2000) {
      return NextResponse.json({ error: '查询内容过长' }, { status: 400 });
    }

    const embeddings = await getEmbeddingProvider();
    await ensureTable(embeddings);
    const results = await searchKnowledge(embeddings, {
      query: query.trim(),
      knowledgeId: knowledgeId || undefined,
      topK: Math.min(topK ?? 5, 20),
      scoreThreshold: scoreThreshold ?? 0,
      metadataFilter: metadataFilter || undefined,
    });

    return NextResponse.json({
      chunks: results.map((r) => ({
        content: r.content,
        score: r.score,
        source: r.filename,
        chunkId: r.chunkId,
        documentId: r.documentId,
        knowledgeId: r.knowledgeId,
      })),
    });
  } catch (err) {
    console.error('[Search API] error:', err);
    return NextResponse.json({ error: '知识搜索失败' }, { status: 500 });
  }
}
