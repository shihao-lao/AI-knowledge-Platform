/**
 * 本地 BGE 中文 Embedding（bge-small-zh-v1.5，512 维，ONNX/transformers.js 运行）
 * 无需 API Key，模型首次调用时自动下载并缓存到本地。
 * 维度与现有 LanceDB 表（512）一致，无需重建向量表。
 */
import { pipeline, env } from '@huggingface/transformers';

// 支持国内镜像下载模型：设置环境变量 HF_ENDPOINT=https://hf-mirror.com 等
if (process.env.HF_ENDPOINT) {
  env.remoteHost = process.env.HF_ENDPOINT.replace(/\/+$/, '') + '/';
}

export const BGE_DIMENSION = 512;
const MODEL_ID = 'Xenova/bge-small-zh-v1.5';

/** bge-zh 官方建议：检索查询前加指令前缀，文档不加 */
const QUERY_INSTRUCTION = '为这个句子生成表示以用于检索相关文章：';

interface TensorLike {
  data: Float32Array;
  dims: number[];
}

type FeatureExtractionFn = (
  texts: string | string[],
  options?: { pooling?: 'mean' | 'cls' | 'none'; normalize?: boolean },
) => Promise<TensorLike>;

let pipelinePromise: Promise<FeatureExtractionFn> | null = null;

function getModel(): Promise<FeatureExtractionFn> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8',
    }) as Promise<FeatureExtractionFn>;
  }
  return pipelinePromise;
}

function toVector(tensor: TensorLike): number[] {
  const { data, dims } = tensor;
  const size = dims.length > 1 ? dims[dims.length - 1] : data.length;
  if (size !== BGE_DIMENSION) {
    throw new Error(`BGE embedding 维度不匹配：期望 ${BGE_DIMENSION}，实际 ${size}`);
  }
  return Array.from(data.slice(0, size));
}

export class BgeEmbeddings {
  async embedQuery(text: string): Promise<number[]> {
    const model = await getModel();
    const output = await model(`${QUERY_INSTRUCTION}${text}`, { pooling: 'cls', normalize: true });
    return toVector(output);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const model = await getModel();
    // 分批避免单次输入过长
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += 8) {
      const batch = texts.slice(i, i + 8);
      const output = await model(batch, { pooling: 'cls', normalize: true });
      // 批量输出：data 为 [batch, hidden] 展平
      const hidden = BGE_DIMENSION;
      const flat = output.data;
      for (let b = 0; b < batch.length; b++) {
        results.push(Array.from(flat.slice(b * hidden, (b + 1) * hidden)));
      }
    }
    return results;
  }
}
