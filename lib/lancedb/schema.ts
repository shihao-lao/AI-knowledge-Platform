export interface VectorRecord {
  id: string;
  chunkId: string;
  text: string;
  vector: number[];
  metadata: {
    userId: string;
    knowledgeId: string;
    documentId: string;
    filename: string;
    /** doc = 文档切片；question = 面试题目卡 */
    type: 'doc' | 'question';
  };
}

export const VECTOR_TABLE_NAME = 'knowledge_chunks';

export const VECTOR_DIMENSION = 512;

export function getVectorDimension(): number {
  return VECTOR_DIMENSION;
}
