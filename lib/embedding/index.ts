import { LocalHashEmbeddings } from './local-embedding';

// OpenAI/DeepSeek embeddings are loaded dynamically to avoid bundling issues

export type EmbeddingProvider = 'openai' | 'deepseek' | 'tensorflow' | 'local';

const PROVIDER: EmbeddingProvider = (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'local';

/** 每个 provider 对应的向量维度 */
export const EMBEDDING_DIMENSION_MAP: Record<EmbeddingProvider, number> = {
  openai: 1536,
  deepseek: 1536,
  tensorflow: 512,
  local: 512,
};

interface EmbeddingInstance {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

let cachedEmbeddings: EmbeddingInstance | null = null;
let cachedProvider: EmbeddingProvider | null = null;

export async function getEmbeddingProvider(): Promise<EmbeddingInstance> {
  if (cachedEmbeddings && cachedProvider === PROVIDER) return cachedEmbeddings;

  if (PROVIDER === 'local') {
    console.log(`[Embedding] provider=local, dim=512 (hash-based, no model download)`);
    cachedEmbeddings = new LocalHashEmbeddings(512);
    cachedProvider = PROVIDER;
    return cachedEmbeddings;
  }

  if (PROVIDER === 'tensorflow') {
    const tf = await import('@tensorflow/tfjs');
    await tf.setBackend('cpu');
    const { TensorFlowEmbeddings } = await import('@langchain/community/embeddings/tensorflow');
    console.log(`[Embedding] provider=tensorflow, model=universal-sentence-encoder, dim=512 (local)`);
    cachedEmbeddings = new TensorFlowEmbeddings();
    cachedProvider = PROVIDER;
    return cachedEmbeddings;
  }

  // OpenAI / DeepSeek — 需要 API key
  const EMBEDDING_BASE_URL_MAP: Record<string, string> = {
    openai: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    deepseek: 'https://api.deepseek.com/v1',
  };
  const EMBEDDING_MODEL_MAP: Record<string, string> = {
    openai: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    deepseek: process.env.DEEPSEEK_EMBEDDING_MODEL || 'deepseek-embedding',
  };

  const apiKey = PROVIDER === 'openai' ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(`Missing API key for embedding provider: ${PROVIDER}`);
  }

  const baseURL = EMBEDDING_BASE_URL_MAP[PROVIDER];
  const model = EMBEDDING_MODEL_MAP[PROVIDER];
  console.log(`[Embedding] provider=${PROVIDER}, model=${model}, baseURL=${baseURL}`);

  const { OpenAIEmbeddings } = await import('@langchain/openai');
  cachedEmbeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    model,
    configuration: { baseURL },
  });
  cachedProvider = PROVIDER;
  return cachedEmbeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const embeddings = await getEmbeddingProvider();
  const result = await embeddings.embedQuery(text);
  return result;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings = await getEmbeddingProvider();
  const result = await embeddings.embedDocuments(texts);
  return result;
}
