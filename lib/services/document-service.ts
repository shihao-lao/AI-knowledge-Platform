import { documentRepo, chunkRepo } from '@/lib/db/knowledge-repository';
import { getEmbeddingProvider, embedBatch } from '@/lib/embedding';
import { parseFile, detectFormat } from '@/lib/parser';
import { chunkDocuments } from '@/lib/rag/chunker';
import { insertVectors, deleteVectors } from '@/lib/lancedb/search';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export const documentService = {
  async upload(knowledgeId: string, file: File) {
    await ensureUploadDir();
    const docId = `doc_${crypto.randomUUID().slice(0, 8)}`;
    const filepath = path.join(UPLOAD_DIR, `${docId}_${file.name}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const format = detectFormat(file.name, file.type);

    const doc = await documentRepo.create({
      id: docId,
      knowledgeId,
      filename: file.name,
      filepath,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    });

    // Background ingestion
    this.ingestDocument(docId, filepath, format).catch((err) => {
      console.error(`[DocumentService] ingestion failed for ${docId}:`, err);
      documentRepo.updateParseStatus(docId, { parseStatus: 'failed' });
    });

    return doc;
  },

  async ingestDocument(docId: string, filepath: string, format: ReturnType<typeof detectFormat>) {
    try {
      console.log(`[Ingest] ${docId}: parsing (format=${format}, path=${filepath})`);
      await documentRepo.updateParseStatus(docId, { parseStatus: 'parsing' });

      const docs = await parseFile(filepath, format);
      const fullText = docs.map((d) => d.pageContent).join('\n');
      console.log(`[Ingest] ${docId}: parsed ${docs.length} docs, ${fullText.length} chars`);

      if (!fullText || fullText.trim().length === 0) {
        console.warn(`[Ingest] ${docId}: parsed content is empty (format=${format})`);
        await documentRepo.updateParseStatus(docId, {
          parseStatus: 'failed',
          charCount: 0,
        });
        return;
      }

      await documentRepo.updateParseStatus(docId, {
        parseStatus: 'chunking',
        charCount: fullText.length,
      });

      const doc = await documentRepo.findById(docId);
      const kbId = doc?.knowledgeId ?? '';
      const contextPrefix = `[文档: ${doc?.filename ?? '未知'}]`;

      const chunks = await chunkDocuments(docs, { contextPrefix });
      console.log(`[Ingest] ${docId}: chunked into ${chunks.length} chunks`);

      if (chunks.length === 0) {
        await documentRepo.updateParseStatus(docId, {
          parseStatus: 'completed',
          chunkCount: 0,
        });
        return;
      }

      console.log(`[Ingest] ${docId}: saving ${chunks.length} chunks to DB`);
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
      console.log(`[Ingest] ${docId}: chunks saved, generating embeddings`);

      const embeddings = await getEmbeddingProvider();
      const texts = chunks.map((c) => c.content);
      const vectors = await embedBatch(texts);
      console.log(`[Ingest] ${docId}: embedded ${vectors.length} vectors (dim=${vectors[0]?.length})`);

      console.log(`[Ingest] ${docId}: inserting vectors into LanceDB`);
      await insertVectors(
        embeddings as any,
        chunks.map((chunk, i) => ({
          id: crypto.randomUUID(),
          chunkId: chunk.id,
          text: chunk.content,
          vector: vectors[i],
          metadata: {
            knowledgeId: kbId,
            documentId: docId,
            filename: doc?.filename ?? '',
          },
        })),
      );

      console.log(`[Ingest] ${docId}: done`);
      await documentRepo.updateParseStatus(docId, {
        parseStatus: 'completed',
        chunkCount: chunks.length,
      });
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

  async delete(id: string) {
    const doc = await documentRepo.findById(id);
    if (!doc) return;

    try {
      await deleteVectors(id);
    } catch {
      /* non-fatal */
    }

    try {
      await unlink(doc.filepath);
    } catch {
      /* file may not exist */
    }

    await documentRepo.delete(id);
  },
};
