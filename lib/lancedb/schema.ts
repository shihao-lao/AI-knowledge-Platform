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

export const VECTOR_DIMENSION = 512;

export function getVectorDimension(): number {
  return VECTOR_DIMENSION;
}
