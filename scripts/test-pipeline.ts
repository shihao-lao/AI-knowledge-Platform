/**
 * 诊断脚本 — 测试 RAG Pipeline 各环节
 * 运行: npx tsx scripts/test-pipeline.ts
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
  console.log('========== RAG Pipeline 诊断 ==========\n');

  // 1. 环境变量
  console.log('--- 1. 环境变量 ---');
  console.log('EMBEDDING_PROVIDER:', process.env.EMBEDDING_PROVIDER);
  console.log(
    'OPENAI_API_KEY:',
    process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.slice(0, 8)}...` : 'MISSING',
  );
  console.log('OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL);
  console.log('OPENAI_EMBEDDING_MODEL:', process.env.OPENAI_EMBEDDING_MODEL);
  console.log();

  // 2. Embedding API
  console.log('--- 2. 测试 Embedding API ---');
  try {
    const { getEmbeddingProvider } = await import('../lib/embedding/index');
    const embeddings = await getEmbeddingProvider();
    console.log('Embedding provider initialized OK');
    const result = await embeddings.embedQuery('测试文本');
    console.log(`Embedding 成功! 维度: ${result.length}`);
    console.log(
      `前3个值: [${result
        .slice(0, 3)
        .map((v: number) => v.toFixed(4))
        .join(', ')}]`,
    );
  } catch (err) {
    console.error('Embedding 失败:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
  }
  console.log();

  // 3. 文件解析
  console.log('--- 3. 测试文件解析 ---');
  try {
    const { parseFile, detectFormat } = await import('../lib/parser/index');
    const { writeFile, mkdir, unlink } = await import('fs/promises');
    const testContent = '这是测试文档第一段。\n\n这是第二段内容。\n\n这是第三段，用于测试切片功能。';
    const testFile = resolve(process.cwd(), 'data', 'test-parse.txt');
    await mkdir(resolve(process.cwd(), 'data'), { recursive: true });
    await writeFile(testFile, testContent, 'utf-8');

    const format = detectFormat('test.txt', 'text/plain');
    console.log(`格式检测: ${format}`);
    const docs = await parseFile(testFile, format);
    console.log(`解析成功! 文档数: ${docs.length}, 内容长度: ${docs[0]?.pageContent?.length}`);
    await unlink(testFile).catch(() => {});
  } catch (err) {
    console.error('解析失败:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
  }
  console.log();

  // 4. 切片
  console.log('--- 4. 测试切片 ---');
  try {
    const { chunkDocuments } = await import('../lib/rag/chunker');
    const { Document } = await import('@langchain/core/documents');
    const longText = '这是一段很长的测试文本，用来验证切片功能是否正常工作。'.repeat(50);
    const testDocs = [new Document({ pageContent: longText, metadata: {} })];
    const chunks = await chunkDocuments(testDocs);
    console.log(`切片成功! 切片数: ${chunks.length}`);
    if (chunks.length > 0) {
      console.log(`第1片长度: ${chunks[0].content.length}`);
    }
  } catch (err) {
    console.error('切片失败:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
  }
  console.log();

  // 5. LanceDB
  console.log('--- 5. 测试 LanceDB ---');
  try {
    const { getLanceDB, ensureTable } = await import('../lib/lancedb/client');
    const db = await getLanceDB();
    console.log('LanceDB 连接成功');
    const embeddings = await (await import('../lib/embedding/index')).getEmbeddingProvider();
    await ensureTable(embeddings);
    console.log('ensureTable 成功');
    const tableNames = await db.tableNames();
    console.log('表列表:', tableNames);
  } catch (err) {
    console.error('LanceDB 失败:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
  }
  console.log();

  // 6. Prisma
  console.log('--- 6. 测试 Prisma ---');
  try {
    const { prisma } = await import('../lib/db/prisma');
    const count = await prisma.knowledge.count();
    console.log(`Prisma 连接成功! 知识库数量: ${count}`);
  } catch (err) {
    console.error('Prisma 失败:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
  }

  console.log('\n========== 诊断完成 ==========');
  process.exit(0);
}

main();
