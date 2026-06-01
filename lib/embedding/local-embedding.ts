/**
 * 轻量级本地 Embedding（基于字符 n-gram 哈希，无需下载模型）
 * 生成 512 维向量，兼容 TensorFlow.js 的维度
 */
export class LocalHashEmbeddings {
  private dimension: number;

  constructor(dimension = 512) {
    this.dimension = dimension;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.textToVector(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.textToVector(t));
  }

  private textToVector(text: string): number[] {
    const vec = new Array(this.dimension).fill(0);
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();

    // 字符级 n-gram（bigram + trigram）
    const ngrams: string[] = [];
    for (let i = 0; i < normalized.length - 1; i++) {
      ngrams.push(normalized.slice(i, i + 2));
    }
    for (let i = 0; i < normalized.length - 2; i++) {
      ngrams.push(normalized.slice(i, i + 3));
    }

    // 用哈希将 n-gram 映射到向量维度
    for (const gram of ngrams) {
      const hash = this.hashCode(gram);
      const idx = Math.abs(hash) % this.dimension;
      const sign = hash & 1 ? 1 : -1;
      vec[idx] += sign;
    }

    // L2 归一化
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) {
        vec[i] /= norm;
      }
    }

    return vec;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash;
  }
}
