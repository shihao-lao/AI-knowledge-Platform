import { LocalHashEmbeddings } from './local-embedding';
import { BgeEmbeddings, BGE_DIMENSION } from './bge';

/**
 * Embedding 提供者：
 * - `bge`  ：本地 BGE 中文模型（bge-small-zh-v1.5，512 维），语义检索，推荐
 * - `local`：字符 n-gram 哈希（512 维），离线可用但无语义，仅作降级/开发
 *
 * 注意：向量表内的向量必须与当前提供者一致。
 * 切换 provider 后请重跑 `npx tsx scripts/reingest-vectors.ts` 重建索引。
 */
const PROVIDER = (process.env.EMBEDDING_PROVIDER || 'local').toLowerCase();

export const EMBEDDING_DIMENSION = PROVIDER === 'bge' ? BGE_DIMENSION : 512;

interface EmbeddingInstance {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

let cachedEmbeddings: EmbeddingInstance | null = null;

export async function getEmbeddingProvider(): Promise<EmbeddingInstance> {
  if (cachedEmbeddings) return cachedEmbeddings;

  if (PROVIDER === 'bge') {
    console.log(`[Embedding] provider=bge, dim=${BGE_DIMENSION} (Xenova/bge-small-zh-v1.5, 首次调用会下载模型)`);
    cachedEmbeddings = new BgeEmbeddings();
  } else {
    console.log(`[Embedding] provider=local, dim=512 (hash-based)`);
    cachedEmbeddings = new LocalHashEmbeddings(512);
  }
  return cachedEmbeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const embeddings = await getEmbeddingProvider();
  return embeddings.embedQuery(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings = await getEmbeddingProvider();
  return embeddings.embedDocuments(texts);
}
