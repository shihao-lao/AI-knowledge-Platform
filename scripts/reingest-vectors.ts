/**
 * 向量重建脚本 — 清空 LanceDB 表并重新摄取所有文档
 * 用途：LanceDB schema 变更（如新增 userId 字段）后重建索引
 * 运行: npx tsx scripts/reingest-vectors.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// 手动加载 .env
try {
  const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  }
} catch {
  /* no .env */
}

async function main() {
  const { prisma } = await import('../lib/db/prisma');
  const { chunkRepo } = await import('../lib/db/knowledge-repository');
  const { documentService } = await import('../lib/services/document-service');
  const { detectFormat } = await import('../lib/parser/index');
  const { getLanceDB, ensureTable } = await import('../lib/lancedb/client');
  const { VECTOR_TABLE_NAME } = await import('../lib/lancedb/schema');

  console.log('========== 向量重建 ==========');

  // 1. 删除旧表（整表重建，schema 以代码为准）
  const db = await getLanceDB();
  const tables = await db.tableNames();
  if (tables.includes(VECTOR_TABLE_NAME)) {
    await db.dropTable(VECTOR_TABLE_NAME);
    console.log('已删除旧表', VECTOR_TABLE_NAME);
  }
  await ensureTable();
  console.log('已重建表', VECTOR_TABLE_NAME);

  // 2. 枚举文档与归属
  const documents = await prisma.document.findMany({ orderBy: { createdAt: 'asc' } });
  const knowledgeMap = new Map(
    (await prisma.knowledge.findMany({ select: { id: true, userId: true } })).map((k) => [k.id, k.userId]),
  );
  console.log(`待处理文档: ${documents.length}`);

  for (const doc of documents) {
    const userId = knowledgeMap.get(doc.knowledgeId);
    if (!userId) {
      console.log(`[skip] ${doc.id} (${doc.filename}) 无归属用户`);
      continue;
    }
    // 清掉旧 chunks，避免重复
    await chunkRepo.deleteByDocumentId(doc.id).catch(() => {});
    try {
      const format = detectFormat(doc.filename, doc.mimeType);
      await documentService.ingestDocument(doc.id, doc.filepath, format, userId);
    } catch (err) {
      console.error(`[exception] ${doc.id} (${doc.filename}):`, err instanceof Error ? err.message : err);
    }
  }

  // 3. 重建题库向量（type=question）
  const questions = await prisma.question.findMany({
    select: { id: true, knowledgeId: true, question: true, answer: true },
  });
  console.log(`待处理题目: ${questions.length}`);
  const { getEmbeddingProvider, embedBatch } = await import('../lib/embedding/index');
  const { insertVectors } = await import('../lib/lancedb/search');

  if (questions.length > 0) {
    const embeddings = await getEmbeddingProvider();
    const texts = questions.map((q) => `[题目: ${q.question}]\n参考答案：${q.answer}`);
    for (let i = 0; i < texts.length; i += 20) {
      const batch = texts.slice(i, i + 20);
      const vectors = await embedBatch(batch);
      const batchQuestions = questions.slice(i, i + 20);
      const records = batchQuestions
        .map((q, j) => {
          const userId = knowledgeMap.get(q.knowledgeId);
          if (!userId) return null;
          return {
            id: crypto.randomUUID(),
            chunkId: `q_${q.id}`,
            text: texts[i + j],
            vector: vectors[j],
            metadata: {
              userId,
              knowledgeId: q.knowledgeId,
              documentId: q.id,
              filename: `题目: ${q.question.slice(0, 60)}`,
              type: 'question' as const,
            },
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (records.length > 0) {
        await insertVectors(embeddings, records);
      }
    }
    console.log(`题目向量重建完成: ${questions.length}`);
  }

  // 4. 汇总结果
  const after = await prisma.document.findMany({ select: { id: true, filename: true, parseStatus: true, chunkCount: true } });
  const ok = after.filter((d) => d.parseStatus === 'completed').length;
  const failed = after.filter((d) => d.parseStatus === 'failed').length;
  console.log(`\n完成: completed=${ok} failed=${failed}`);
  for (const d of after.filter((d) => d.parseStatus !== 'completed')) {
    console.log(`  - ${d.filename}: ${d.parseStatus}`);
  }
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
