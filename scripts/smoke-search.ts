/**
 * 混合检索冒烟测试：验证 FTS（BM25）索引创建与向量+FTS RRF 融合
 * 运行: npx tsx scripts/smoke-search.ts
 */
import { getEmbeddingProvider } from '../lib/embedding/index';
import { ensureTable } from '../lib/lancedb/client';
import { searchKnowledge } from '../lib/lancedb/search';

async function main() {
  await ensureTable();
  const embeddings = await getEmbeddingProvider();
  const query = '咖啡';
  const results = await searchKnowledge(embeddings, { query, topK: 5 });
  console.log(`query="${query}" -> ${results.length} results`);
  for (const r of results) {
    console.log(`  score=${r.score} src=${r.filename} | ${r.content.slice(0, 40).replace(/\n/g, ' ')}`);
  }
  // 索引列表确认
  const { getLanceDB } = await import('../lib/lancedb/client');
  const { VECTOR_TABLE_NAME } = await import('../lib/lancedb/schema');
  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);
  const indices = await table.listIndices();
  console.log('indices:', indices.map((i) => `${i.name}(${i.indexType})`).join(', '));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
