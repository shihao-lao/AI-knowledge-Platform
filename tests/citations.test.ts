import { describe, it, expect } from 'vitest';
import { extractCitations } from '@/lib/server/rag/citations';
import type { SearchResult } from '@/lib/lancedb/search';

function chunk(id: string, filename: string, content: string): SearchResult {
  return {
    content,
    score: 0.8,
    chunkId: id,
    chunkIndex: 0,
    documentId: `doc_${id}`,
    filename,
    knowledgeId: 'kb_test',
  };
}

describe('extractCitations 引用提取', () => {
  const chunks = [
    chunk('c1', '文档A.txt', '[文档: 文档A.txt]\n事件循环原理...'),
    chunk('c2', '题目: 什么是闭包', '[题目: 什么是闭包]\n参考答案：...'),
    chunk('c3', '文档C.txt', '一些内容'),
  ];

  it('提取实际引用的编号并按顺序映射', () => {
    const citations = extractCitations('根据资料 [2] 和 [1] 可知。', chunks);
    expect(citations).toHaveLength(2);
    expect(citations[0].documentTitle).toBe('文档A.txt');
    expect(citations[1].documentTitle).toBe('题目: 什么是闭包');
  });

  it('忽略超出范围的编号', () => {
    expect(extractCitations('引用 [5] 和 [99]', chunks)).toHaveLength(0);
  });

  it('无引用标记返回空', () => {
    expect(extractCitations('没有任何引用', chunks)).toEqual([]);
  });

  it('重复引用只保留一次', () => {
    const citations = extractCitations('[1] 详见 [1]', chunks);
    expect(citations).toHaveLength(1);
  });

  it('preview 去除文档/题目前缀', () => {
    const [c1] = extractCitations('[1]', chunks);
    expect(c1.preview.startsWith('[文档:')).toBe(false);
    const [c2] = extractCitations('[2]', chunks);
    expect(c2.preview.startsWith('[题目:')).toBe(false);
  });
});
