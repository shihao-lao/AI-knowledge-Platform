import { OpenAIEmbeddings } from '@langchain/openai';
import type { Embeddings } from '@langchain/core/embeddings';

export type EmbeddingProvider = 'openai' | 'deepseek';

const PROVIDER: EmbeddingProvider = (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'openai';

const EMBEDDING_BASE_URL_MAP: Record<EmbeddingProvider, string> = {
  openai: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
};

const EMBEDDING_MODEL_MAP: Record<EmbeddingProvider, string> = {
  openai: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  deepseek: process.env.DEEPSEEK_EMBEDDING_MODEL || 'deepseek-embedding',
};

let cachedEmbeddings: Embeddings | null = null;

export function getEmbeddingProvider(): Embeddings {
  if (cachedEmbeddings) return cachedEmbeddings;

  const apiKey =
    PROVIDER === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.DEEPSEEK_API_KEY;

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

  return cachedEmbeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const embeddings = getEmbeddingProvider();
  const result = await embeddings.embedQuery(text);
  return result;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings = getEmbeddingProvider();
  const result = await embeddings.embedDocuments(texts);
  return result;
}
