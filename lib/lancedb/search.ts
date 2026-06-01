import type { Embeddings } from '@langchain/core/embeddings';
import { getVectorStore, getLanceDB } from './client';
import { VECTOR_TABLE_NAME, type VectorRecord } from './schema';

export interface SearchParams {
  query: string;
  knowledgeId?: string;
  topK?: number;
  scoreThreshold?: number;
  metadataFilter?: Partial<VectorRecord['metadata']>;
}

export interface SearchResult {
  content: string;
  score: number;
  chunkId: string;
  documentId: string;
  filename: string;
  knowledgeId: string;
}

export async function searchKnowledge(embeddings: Embeddings, params: SearchParams): Promise<SearchResult[]> {
  const { query, topK = 5, scoreThreshold = 0, knowledgeId } = params;

  const queryEmbedding = await embeddings.embedQuery(query);

  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);

  const queryBuilder = table
    .query()
    .nearestTo(queryEmbedding)
    .limit(Math.max(topK * 3, 20));

  if (knowledgeId) {
    const safeId = knowledgeId.replace(/'/g, "''");
    // Columns are top-level (not nested under metadata)
    queryBuilder.where(`knowledgeId = '${safeId}'`);
  }

  const results = await queryBuilder.toArray();

  // Calculate raw scores (1 / (1 + distance)) for all results
  const withScore = results.map((item: Record<string, unknown>) => {
    const distance = (item._distance as number) ?? 0;
    return { item, distance, rawScore: 1 / (1 + distance) };
  });

  // Filter by threshold
  const filtered = withScore.filter((r) => r.rawScore >= scoreThreshold).slice(0, topK);

  if (filtered.length === 0) return [];

  // Normalize scores relative to the best match to avoid low absolute values
  // with weaker embedding providers (e.g. local hash-based)
  const maxDistance = Math.min(...filtered.map((r) => r.distance));
  const minDistance = Math.max(...filtered.map((r) => r.distance));
  const distanceRange = minDistance - maxDistance;

  return filtered.map((r) => {
    // Map distance to 0.5–1.0 range: closest → 1.0, farthest → 0.5
    const normalized = distanceRange > 0 ? 0.5 + 0.5 * ((minDistance - r.distance) / distanceRange) : 1.0;
    return {
      content: (r.item.text as string) ?? '',
      score: Number(normalized.toFixed(4)),
      chunkId: (r.item.chunkId as string) ?? '',
      documentId: (r.item.documentId as string) ?? '',
      filename: (r.item.filename as string) ?? '',
      knowledgeId: (r.item.knowledgeId as string) ?? '',
    };
  });
}

export async function insertVectors(embeddings: Embeddings, records: VectorRecord[]): Promise<void> {
  const store = await getVectorStore(embeddings);
  // LangChain LanceDB wrapper spreads metadata as top-level columns
  const docs = records.map((r) => ({
    pageContent: r.text,
    metadata: {
      id: r.id,
      chunkId: r.chunkId,
      documentId: r.metadata.documentId,
      filename: r.metadata.filename,
      knowledgeId: r.metadata.knowledgeId,
    },
  }));
  await store.addDocuments(docs);
}

export async function deleteVectors(documentId: string): Promise<void> {
  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);
  const safeId = documentId.replace(/'/g, "''");
  // Columns are top-level (not nested under metadata)
  await table.delete(`documentId = '${safeId}'`);
}

export async function deleteVectorsByKnowledgeId(knowledgeId: string): Promise<void> {
  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);
  const safeId = knowledgeId.replace(/'/g, "''");
  // Columns are top-level (not nested under metadata)
  await table.delete(`knowledgeId = '${safeId}'`);
}
