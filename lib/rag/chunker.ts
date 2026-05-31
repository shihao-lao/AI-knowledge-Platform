import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { Document } from '@langchain/core/documents';

export interface ChunkResult {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export interface ChunkerConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

const DEFAULT_CONFIG: Required<ChunkerConfig> = {
  chunkSize: 500,
  chunkOverlap: 100,
  separators: ['\n\n', '\n', '。', '！', '？', '；', '.', '!', '?', ';', ' ', ''],
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

export async function chunkDocuments(docs: Document[], config?: ChunkerConfig): Promise<ChunkResult[]> {
  const { chunkSize, chunkOverlap, separators } = { ...DEFAULT_CONFIG, ...config };

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators,
  });

  const splits = await splitter.splitDocuments(docs);

  return splits.map((split, index) => ({
    id: crypto.randomUUID(),
    chunkIndex: index,
    content: split.pageContent,
    tokenCount: estimateTokens(split.pageContent),
  }));
}
