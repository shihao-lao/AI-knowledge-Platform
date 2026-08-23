/**
 * 引用解析（纯函数，便于单测）
 */
import type { SearchResult } from '@/lib/lancedb/search';
import type { Citation } from '@/types';

export function toCitation(r: SearchResult): Citation {
  const preview = r.content.replace(/^\[(文档|题目):.*?\]\r?\n?/, '').slice(0, 100);
  return {
    documentId: r.documentId,
    documentTitle: r.filename,
    chunkIndex: r.chunkIndex,
    preview: preview + (r.content.length > 100 ? '...' : ''),
    confidenceScore: r.score,
  };
}

/** 从模型输出中提取实际被引用的编号，并映射回检索结果 */
export function extractCitations(content: string, chunks: SearchResult[]): Citation[] {
  const cited = new Set<number>();
  const re = /\[(\d{1,2})\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n >= 1 && n <= chunks.length) {
      cited.add(n);
    }
  }
  return [...cited].sort((a, b) => a - b).map((i) => toCitation(chunks[i - 1]));
}
