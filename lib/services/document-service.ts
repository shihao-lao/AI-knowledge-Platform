import { documentRepo, chunkRepo } from '@/lib/db/knowledge-repository';
import { getEmbeddingProvider, embedBatch } from '@/lib/embedding';
import { parseFile, detectFormat } from '@/lib/parser';
import { chunkDocuments } from '@/lib/rag/chunker';
import { insertVectors, deleteVectors } from '@/lib/lancedb/search';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

/** 每批 embedding 的 chunk 数量，避免 OOM */
const EMBED_BATCH_SIZE = 20;

/** 全局串行队列：同一时间只处理一个文档的 ingest，避免 TF/LanceDB 并发冲突 */
let ingestQueue: Promise<void> = Promise.resolve();

function enqueueIngest(fn: () => Promise<void>): void {
  ingestQueue = ingestQueue.then(fn).catch((err) => {
    console.error('[IngestQueue] unhandled error in queue:', err);
  });
}

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export const documentService = {
  async upload(knowledgeId: string, userId: string, file: File) {
    await ensureUploadDir();
    const docId = `doc_${crypto.randomUUID().slice(0, 8)}`;
    const filepath = path.join(UPLOAD_DIR, `${docId}_${file.name}`);
    const format = detectFormat(file.name, file.type);

    // ① 先写 DB 记录（拿到 docId），状态 uploading
    const doc = await documentRepo.create({
      id: docId,
      knowledgeId,
      filename: file.name,
      filepath,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    });
    await documentRepo.updateParseStatus(docId, { parseStatus: 'uploading' });

    // ② 再写文件到磁盘 — 如果失败，删除 DB 记录
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filepath, buffer);
    } catch (err) {
      console.error(`[DocumentService] file write failed for ${docId}, cleaning up DB:`, err);
      await documentRepo.delete(docId).catch(() => {});
      throw err;
    }

    // ③ 入队后台处理（串行，不会并发）
    enqueueIngest(() => this.ingestDocument(docId, filepath, format, userId));

    return doc;
  },

  async ingestDocument(docId: string, filepath: string, format: ReturnType<typeof detectFormat>, userId: string) {
    const startTime = Date.now();
    try {
      // ── 阶段 1: parsing ──
      console.log(`[Ingest] ${docId}: parsing (format=${format}, path=${filepath})`);
      await documentRepo.updateParseStatus(docId, { parseStatus: 'parsing' });

      const docs = await parseFile(filepath, format);
      const fullText = docs.map((d) => d.pageContent).join('\n');
      console.log(`[Ingest] ${docId}: parsed ${docs.length} docs, ${fullText.length} chars`);

      if (!fullText || fullText.trim().length === 0) {
        console.warn(`[Ingest] ${docId}: parsed content is empty (format=${format})`);
        await documentRepo.updateParseStatus(docId, { parseStatus: 'failed', charCount: 0 });
        return;
      }

      // ── 阶段 2: chunking ──
      await documentRepo.updateParseStatus(docId, { parseStatus: 'chunking', charCount: fullText.length });

      const doc = await documentRepo.findById(docId);
      const kbId = doc?.knowledgeId ?? '';
      const contextPrefix = `[文档: ${doc?.filename ?? '未知'}]`;

      const chunks = await chunkDocuments(docs, { contextPrefix });
      console.log(`[Ingest] ${docId}: chunked into ${chunks.length} chunks`);

      // 切片完成，立即更新 chunkCount（前端可看到切片数）
      await documentRepo.updateParseStatus(docId, { parseStatus: 'chunking', chunkCount: chunks.length });

      if (chunks.length === 0) {
        await documentRepo.updateParseStatus(docId, { parseStatus: 'completed', chunkCount: 0 });
        return;
      }

      // ── 阶段 3: embedding（分批） ──
      await documentRepo.updateParseStatus(docId, { parseStatus: 'embedding' });

      await chunkRepo.createMany(
        chunks.map((chunk) => ({
          id: chunk.id,
          documentId: docId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
        })),
      );
      console.log(`[Ingest] ${docId}: ${chunks.length} chunks saved to DB`);

      const embeddings = await getEmbeddingProvider();
      const totalBatches = Math.ceil(chunks.length / EMBED_BATCH_SIZE);
      const allVectors: number[][] = [];
      const embedStartTime = Date.now();

      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batchIdx = Math.floor(i / EMBED_BATCH_SIZE) + 1;
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        const batchStart = Date.now();
        const batchVectors = await embedBatch(batch.map((c) => c.content));
        allVectors.push(...batchVectors);
        const batchMs = Date.now() - batchStart;
        console.log(`[Ingest] ${docId}: embedding batch ${batchIdx}/${totalBatches} (${allVectors.length}/${chunks.length} vectors, ${batchMs}ms)`);
      }
      const embedTotalMs = Date.now() - embedStartTime;
      console.log(`[Ingest] ${docId}: all ${allVectors.length} vectors embedded in ${embedTotalMs}ms (dim=${allVectors[0]?.length})`);

      // ── 阶段 4: 写入 LanceDB ──
      try {
        console.log(`[Ingest] ${docId}: inserting vectors into LanceDB`);
        await insertVectors(
          embeddings,
          chunks.map((chunk, i) => ({
            id: crypto.randomUUID(),
            chunkId: chunk.id,
            text: chunk.content,
            vector: allVectors[i],
            metadata: { userId, knowledgeId: kbId, documentId: docId, filename: doc?.filename ?? '' },
          })),
        );
      } catch (vectorErr) {
        console.error(`[Ingest] ${docId}: LanceDB insert failed, rolling back chunks:`, vectorErr);
        await chunkRepo.deleteByDocumentId(docId).catch(() => {});
        await documentRepo.updateParseStatus(docId, { parseStatus: 'failed' });
        return;
      }

      // ── 完成 ──
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Ingest] ${docId}: completed in ${elapsed}s, ${chunks.length} chunks`);
      await documentRepo.updateParseStatus(docId, { parseStatus: 'completed', chunkCount: chunks.length });
    } catch (err) {
      const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
      console.error(`[Ingest] ${docId} FAILED:`, errMsg);
      try {
        await documentRepo.updateParseStatus(docId, { parseStatus: 'failed' });
      } catch (updateErr) {
        console.error(`[Ingest] ${docId}: failed to update status:`, updateErr);
      }
    }
  },

  async updateEnabled(id: string, enabled: boolean) {
    return documentRepo.updateEnabled(id, enabled);
  },

  list(knowledgeId: string) {
    return documentRepo.list(knowledgeId);
  },

  findById(id: string) {
    return documentRepo.findById(id);
  },

  async delete(id: string, userId?: string) {
    const doc = await documentRepo.findById(id);
    if (!doc) return;

    // 并行清理向量、文件、DB 记录
    await Promise.allSettled([
      deleteVectors(id, userId).catch(() => {}),
      doc.filepath ? unlink(doc.filepath).catch(() => {}) : Promise.resolve(),
    ]);

    await documentRepo.delete(id);
  },
};
