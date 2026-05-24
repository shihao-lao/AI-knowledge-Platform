export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export function buildVocabulary(documents: string[]): Map<string, number> {
  const vocab = new Map<string, number>();
  let index = 0;

  for (const doc of documents) {
    const tokens = tokenize(doc);
    for (const token of tokens) {
      if (!vocab.has(token)) {
        vocab.set(token, index++);
      }
    }
  }

  return vocab;
}

export function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const totalTokens = tokens.length;

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  tf.forEach((count, token) => {
    tf.set(token, count / totalTokens);
  });

  return tf;
}

export function computeIDF(documents: string[], vocabulary: Map<string, number>): Map<string, number> {
  const idf = new Map<string, number>();
  const N = documents.length;
  const docCount = new Map<string, number>();

  for (const doc of documents) {
    const tokens = new Set(tokenize(doc));
    for (const token of tokens) {
      docCount.set(token, (docCount.get(token) || 0) + 1);
    }
  }

  vocabulary.forEach((_, term) => {
    const df = docCount.get(term) || 0;
    idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
  });

  return idf;
}

export function textToVector(
  text: string,
  vocabulary: Map<string, number>,
  idf: Map<string, number>
): Float64Array {
  const vector = new Float64Array(vocabulary.size).fill(0);
  const tokens = tokenize(text);
  const tf = computeTF(tokens);

  tf.forEach((value, term) => {
    if (vocabulary.has(term)) {
      const index = vocabulary.get(term)!;
      vector[index] = value * (idf.get(term) || 1);
    }
  });

  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

export function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export class VectorEmbeddingService {
  private vocabulary: Map<string, number> | null = null;
  private idf: Map<string, number> | null = null;
  private documents: string[] = [];

  async initialize(documents: string[]) {
    this.documents = documents;
    this.vocabulary = buildVocabulary(documents);
    this.idf = computeIDF(documents, this.vocabulary);
  }

  embed(text: string): Float64Array {
    if (!this.vocabulary || !this.idf) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    return textToVector(text, this.vocabulary, this.idf);
  }

  getVocabulary(): Map<string, number> {
    return this.vocabulary!;
  }

  getIDF(): Map<string, number> {
    return this.idf!;
  }
}
