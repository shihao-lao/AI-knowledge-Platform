export interface VectorRecord {
  id: string;
  chunkId: string;
  text: string;
  vector: number[];
  metadata: {
    knowledgeId: string;
    documentId: string;
    filename: string;
  };
}

export const VECTOR_TABLE_NAME = 'knowledge_chunks';

/** 向量维度，由当前 embedding provider 决定 */
const DIMENSION_MAP: Record<string, number> = {
  openai: 1536,
  deepseek: 1536,
  tensorflow: 512,
  local: 512,
};

export function getVectorDimension(): number {
  const provider = process.env.EMBEDDING_PROVIDER || 'local';
  return DIMENSION_MAP[provider] ?? 512;
}

/** @deprecated 使用 getVectorDimension() 代替 */
export const VECTOR_DIMENSION = 1536;
