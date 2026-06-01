import { OpenAIEmbeddings } from '@langchain/openai';
import type { Embeddings } from '@langchain/core/embeddings';

type EmbeddingProvider = 'openai' | 'deepseek' | 'local';

const PROVIDER: EmbeddingProvider = (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'local';

let cachedEmbeddings: Embeddings | null = null;
let cachedProvider: EmbeddingProvider | null = null;

/**
 * 基于 @xenova/transformers 的本地 Embeddings
 * 使用 all-MiniLM-L6-v2 模型，384 维，CPU 推理 ~50ms/chunk
 */
type PipelineFn = (text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array }>;

class LocalEmbeddings implements Embeddings {
  private pipeline: PipelineFn | null = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  private async getPipeline() {
    if (!this.pipeline) {
      const { pipeline } = await import('@xenova/transformers');
      this.pipeline = await pipeline('feature-extraction', this.modelName);
      console.log(`[Embedding] local model loaded: ${this.modelName}`);
    }
    return this.pipeline;
  }

  async embedQuery(text: string): Promise<number[]> {
    const pipe = await this.getPipeline();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data) as number[];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const pipe = await this.getPipeline();
    const results: number[][] = [];
    // 逐条处理，避免内存峰值过高
    for (const text of texts) {
      const output = await pipe(text, { pooling: 'mean', normalize: true });
      results.push(Array.from(output.data) as number[]);
    }
    return results;
  }
}

export async function getEmbeddingProvider(): Promise<Embeddings> {
  if (cachedEmbeddings && cachedProvider === PROVIDER) return cachedEmbeddings;

  if (PROVIDER === 'local') {
    console.log(`[Embedding] provider=local, model=all-MiniLM-L6-v2, dim=384`);
    cachedEmbeddings = new LocalEmbeddings();
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

  cachedEmbeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    model,
    configuration: { baseURL },
  });
  cachedProvider = PROVIDER;
  return cachedEmbeddings;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings = await getEmbeddingProvider();
  const result = await embeddings.embedDocuments(texts);
  return result;
}
