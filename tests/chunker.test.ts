import { describe, it, expect } from 'vitest';
import { chunkDocuments } from '@/lib/rag/chunker';
import { Document } from '@langchain/core/documents';

describe('chunkDocuments 文本分块', () => {
  it('短文本不切分', async () => {
    const chunks = await chunkDocuments([new Document({ pageContent: '短文本', metadata: {} })]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('短文本');
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('长文本按 chunkSize 切分且带重叠', async () => {
    const longText = '这是一段用于测试分块的文本。'.repeat(120);
    const chunks = await chunkDocuments([new Document({ pageContent: longText, metadata: {} })], {
      chunkSize: 100,
      chunkOverlap: 20,
    });
    expect(chunks.length).toBeGreaterThan(1);
    // 每片不超过 chunkSize + 前缀
    chunks.forEach((c) => expect(c.content.length).toBeLessThanOrEqual(100));
    // chunkIndex 连续
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('contextPrefix 拼接到每片开头', async () => {
    const chunks = await chunkDocuments([new Document({ pageContent: '内容', metadata: {} })], {
      contextPrefix: '[文档: test.txt]',
    });
    expect(chunks[0].content.startsWith('[文档: test.txt]')).toBe(true);
  });

  it('生成的 id 唯一', async () => {
    const longText = '分片测试文本。'.repeat(100);
    const chunks = await chunkDocuments([new Document({ pageContent: longText, metadata: {} })], {
      chunkSize: 50,
      chunkOverlap: 10,
    });
    const ids = new Set(chunks.map((c) => c.id));
    expect(ids.size).toBe(chunks.length);
  });
});
