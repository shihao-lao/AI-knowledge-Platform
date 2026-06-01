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
  /** 文档标题/文件名，拼接到每个 chunk 前面以增强 embedding 语义 */
  contextPrefix?: string;
}

const DEFAULT_CONFIG: Required<ChunkerConfig> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '。', '！', '？', '；', '，', '.', '!', '?', ';', ',', ' ', ''],
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

export async function chunkDocuments(docs: Document[], config?: ChunkerConfig): Promise<ChunkResult[]> {
  const { chunkSize, chunkOverlap, separators, contextPrefix } = { ...DEFAULT_CONFIG, ...config };

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators,
  });

  const splits = await splitter.splitDocuments(docs);

  return splits.map((split, index) => {
    const content = contextPrefix ? `${contextPrefix}\n${split.pageContent}` : split.pageContent;
    return {
      id: crypto.randomUUID(),
      chunkIndex: index,
      content,
      tokenCount: estimateTokens(content),
    };
  });
}
