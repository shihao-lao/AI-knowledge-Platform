import { LocalHashEmbeddings } from './local-embedding';

export type EmbeddingProvider = 'tensorflow' | 'local';

const PROVIDER: EmbeddingProvider = (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'tensorflow';

export const EMBEDDING_DIMENSION = 512;

interface EmbeddingInstance {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

let cachedEmbeddings: EmbeddingInstance | null = null;
let cachedProvider: EmbeddingProvider | null = null;

export async function getEmbeddingProvider(): Promise<EmbeddingInstance> {
  if (cachedEmbeddings && cachedProvider === PROVIDER) return cachedEmbeddings;

  if (PROVIDER === 'tensorflow') {
    const tf = await import('@tensorflow/tfjs');
    await tf.setBackend('cpu');
    const { TensorFlowEmbeddings } = await import('@langchain/community/embeddings/tensorflow');
    console.log(`[Embedding] provider=tensorflow, model=universal-sentence-encoder, dim=${EMBEDDING_DIMENSION}`);
    cachedEmbeddings = new TensorFlowEmbeddings();
    cachedProvider = PROVIDER;
    return cachedEmbeddings;
  }

  // local — 基于字符 n-gram 哈希，无需下载模型
  console.log(`[Embedding] provider=local, dim=${EMBEDDING_DIMENSION} (hash-based, no model download)`);
  cachedEmbeddings = new LocalHashEmbeddings(EMBEDDING_DIMENSION);
  cachedProvider = PROVIDER;
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
