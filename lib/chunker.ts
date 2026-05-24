import { prisma } from './prisma';
import { VectorEmbeddingService, cosineSimilarity, textToVector } from './embedding';

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const embeddingService = new VectorEmbeddingService();

export interface ChunkResult {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export function splitTextIntoChunks(text: string): ChunkResult[] {
  const chunks: ChunkResult[] = [];

  if (!text || text.trim().length === 0) {
    return chunks;
  }

  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    if (currentChunk.length + trimmedParagraph.length > CHUNK_SIZE && currentChunk.length > 0) {
      const overlapText = currentChunk.slice(-CHUNK_OVERLAP);
      chunks.push({
        chunkIndex: chunkIndex++,
        content: currentChunk,
        tokenCount: estimateTokenCount(currentChunk),
      });
      currentChunk = overlapText + '\n\n' + trimmedParagraph;
    } else {
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + trimmedParagraph;
      } else {
        currentChunk = trimmedParagraph;
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      chunkIndex: chunkIndex++,
      content: currentChunk,
      tokenCount: estimateTokenCount(currentChunk),
    });
  }

  return chunks;
}

function estimateTokenCount(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}

export async function processDocumentForRAG(documentId: string): Promise<number> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  await prisma.documentChunk.deleteMany({
    where: { documentId },
  });

  const chunks = splitTextIntoChunks(document.content);

  if (chunks.length === 0) {
    return 0;
  }

  const allContents = chunks.map((c) => c.content);
  await embeddingService.initialize(allContents);

  for (const chunk of chunks) {
    const vector = embeddingService.embed(chunk.content);

    await prisma.documentChunk.create({
      data: {
        documentId,
        knowledgeBaseId: document.knowledgeBaseId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: JSON.stringify(Array.from(vector)),
      },
    });
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'completed',
      processingProgress: 100,
      chunkCount: chunks.length,
    },
  });

  return chunks.length;
}

export async function processAllDocumentsInKnowledgeBase(
  knowledgeBaseId: string
): Promise<{ processed: number; total: number }> {
  const documents = await prisma.document.findMany({
    where: { knowledgeBaseId },
  });

  let processed = 0;

  for (const doc of documents) {
    try {
      await processDocumentForRAG(doc.id);
      processed++;
    } catch (error) {
      console.error(`Failed to process document ${doc.id}:`, error);
    }
  }

  return { processed, total: documents.length };
}
