import { prisma } from './prisma';
import { VectorEmbeddingService, cosineSimilarity, tokenize, textToVector, buildVocabulary, computeIDF } from './embedding';
import type { Citation } from '@/types';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  preview: string;
}

export interface RAGResult {
  context: string;
  citations: Citation[];
  retrievedChunks: RetrievedChunk[];
}

function keywordMatchScore(query: string, content: string): number {
  const queryTokens = new Set(tokenize(query));
  const contentTokens = tokenize(content);

  if (queryTokens.size === 0) return 0;

  let matchCount = 0;
  for (const token of queryTokens) {
    if (contentTokens.includes(token)) {
      matchCount++;
    }
  }

  return matchCount / queryTokens.size;
}

export async function retrieveRelevantChunks(
  query: string,
  knowledgeBaseId: string,
  topK: number = 3
): Promise<RetrievedChunk[]> {
  const chunks = await prisma.documentChunk.findMany({
    where: {
      knowledgeBaseId,
      embedding: { not: '' },
    },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          fileName: true,
        },
      },
    },
  });

  if (chunks.length === 0) {
    return [];
  }

  let scoredChunks: RetrievedChunk[] = [];

  const hasEmbeddings = chunks.some((c) => c.embedding && c.embedding !== '');

  if (hasEmbeddings) {
    try {
      const allContents = chunks.map((c) => c.content);
      const vocabulary = buildVocabulary(allContents);
      const idf = computeIDF(allContents, vocabulary);

      const queryVector = textToVector(query, vocabulary, idf);

      scoredChunks = chunks
        .map((chunk) => {
          if (!chunk.embedding || chunk.embedding === '') {
            return null;
          }
          try {
            const storedVector = new Float64Array(JSON.parse(chunk.embedding));
            const similarity = cosineSimilarity(queryVector, storedVector);

            return {
              id: chunk.id,
              documentId: chunk.documentId,
              documentTitle: chunk.document.fileName || chunk.document.title,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              similarity,
              preview: generatePreview(chunk.content),
            };
          } catch {
            return null;
          }
        })
        .filter((chunk): chunk is RetrievedChunk => chunk !== null && chunk.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      console.error('Vector search failed, falling back to keyword matching:', error);
    }
  }

  if (scoredChunks.length === 0) {
    console.log('Using keyword-based retrieval as fallback');

    scoredChunks = chunks
      .map((chunk) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        documentTitle: chunk.document.fileName || chunk.document.title,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        similarity: keywordMatchScore(query, chunk.content),
        preview: generatePreview(chunk.content),
      }))
      .filter((chunk) => chunk.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  return scoredChunks;
}

function generatePreview(content: string, maxLength: number = 100): string {
  const cleaned = content.replace(/\n+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength) + '...';
}

export function buildRAGContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '';
  }

  const contextParts = chunks.map(
    (chunk, index) =>
      `[文档片段 ${index + 1}]\n来源：${chunk.documentTitle}\n相关度：${(chunk.similarity * 100).toFixed(1)}%\n内容：${chunk.content}`
  );

  return `以下是知识库中与用户问题相关的文档片段：\n\n${contextParts.join('\n\n')}`;
}

export function convertToCitations(chunks: RetrievedChunk[]): Citation[] {
  const colors = ['#1677ff', '#faad14', '#52c41a', '#f5222d', '#722ed1'];

  return chunks.map((chunk, index) => ({
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    chunkIndex: chunk.chunkIndex,
    preview: chunk.preview,
    confidenceScore: Math.min(Math.max(chunk.similarity, 0.3), 1),
    color: colors[index % colors.length],
  }));
}

export async function performRAGRetrieval(
  query: string,
  knowledgeBaseId: string
): Promise<RAGResult> {
  const retrievedChunks = await retrieveRelevantChunks(query, knowledgeBaseId);

  if (retrievedChunks.length === 0) {
    return {
      context: '',
      citations: [],
      retrievedChunks: [],
    };
  }

  const context = buildRAGContext(retrievedChunks);
  const citations = convertToCitations(retrievedChunks);

  return {
    context,
    citations,
    retrievedChunks,
  };
}
