import type { Embeddings } from '@langchain/core/embeddings';
import { getLanceDB } from './client';
import { VECTOR_TABLE_NAME, type VectorRecord } from './schema';

function sanitizeId(id: string): string {
  if (!/^[\w.\-]+$/.test(id)) {
    throw new Error('Invalid ID format');
  }
  return id;
}

export interface SearchParams {
  query: string;
  knowledgeId?: string;
  topK?: number;
  scoreThreshold?: number;
  metadataFilter?: Partial<VectorRecord['metadata']>;
}

export interface SearchResult {
  content: string;
  score: number;
  chunkId: string;
  documentId: string;
  filename: string;
  knowledgeId: string;
}

/** Reciprocal Rank Fusion 常量 */
const RRF_K = 60;

/**
 * 从查询中提取关键词（去停用词、按长度过滤）
 */
function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    '的',
    '了',
    '是',
    '在',
    '我',
    '有',
    '和',
    '就',
    '不',
    '人',
    '都',
    '一',
    '一个',
    '上',
    '也',
    '很',
    '到',
    '说',
    '要',
    '去',
    '你',
    '会',
    '着',
    '没有',
    '看',
    '好',
    '自己',
    '这',
    '他',
    '吗',
    '那',
    '么',
    '什么',
    '怎么',
    '如何',
    '哪些',
    '哪个',
    '请',
    '能',
    '可以',
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'can',
    'shall',
    'it',
    'its',
    'this',
    'that',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'we',
    'they',
    'me',
    'him',
    'her',
    'us',
    'them',
    'my',
    'your',
    'his',
    'our',
    'their',
    'what',
    'which',
    'who',
    'whom',
    'how',
    'when',
    'where',
    'why',
    'and',
    'but',
    'or',
    'nor',
    'not',
    'so',
    'yet',
    'both',
    'either',
    'neither',
    'each',
    'every',
    'all',
    'any',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'only',
    'own',
    'same',
    'than',
    'too',
    'very',
    'just',
    'because',
    'as',
    'until',
    'while',
    'of',
    'at',
    'by',
    'for',
    'with',
    'about',
    'against',
    'between',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'to',
    'from',
    'up',
    'down',
    'in',
    'out',
    'on',
    'off',
    'over',
    'under',
    'again',
    'further',
    'then',
    'once',
  ]);

  // 按空白和中英文标点分词
  const tokens = query
    .toLowerCase()
    .split(/[\s,.;:!?　、。！，．；：？‘’“”《》]+/)
    .filter((t) => t.length >= 2 && !stopWords.has(t));

  return [...new Set(tokens)];
}

/**
 * 计算文本与关键词的匹配分数（命中关键词数 / 总关键词数）
 */
function keywordMatchScore(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) hits++;
  }
  return hits / keywords.length;
}

/**
 * 混合搜索：向量语义搜索 + 关键词匹配，通过 RRF 融合排名
 */
export async function searchKnowledge(embeddings: Embeddings, params: SearchParams): Promise<SearchResult[]> {
  const { query, topK = 5, scoreThreshold = 0, knowledgeId } = params;

  const queryEmbedding = await embeddings.embedQuery(query);
  const keywords = extractKeywords(query);

  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);

  // 获取较宽的候选池（用于向量搜索和关键词匹配）
  const candidateLimit = Math.max(topK * 4, 30);
  const queryBuilder = table.query().nearestTo(queryEmbedding).limit(candidateLimit);

  if (knowledgeId) {
    const safeId = sanitizeId(knowledgeId);
    queryBuilder.where(`knowledgeId = '${safeId}'`);
  }

  const rawResults = await queryBuilder.toArray();

  if (rawResults.length === 0) return [];

  // --- 向量搜索排名（按 distance 升序，rank 从 0 开始） ---
  const vectorRanked = rawResults
    .map((item: Record<string, unknown>) => ({
      item,
      distance: (item._distance as number) ?? 0,
    }))
    .sort((a, b) => a.distance - b.distance);

  // 构建 chunkId → vector rank 的映射
  const vectorRankMap = new Map<string, number>();
  vectorRanked.forEach((r, rank) => {
    const id = (r.item.chunkId as string) || (r.item.id as string);
    vectorRankMap.set(id, rank);
  });

  // --- 关键词匹配排名（按匹配度降序） ---
  const keywordRanked =
    keywords.length > 0
      ? [...rawResults]
          .map((item: Record<string, unknown>) => ({
            item,
            score: keywordMatchScore((item.text as string) ?? '', keywords),
          }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
      : [];

  const keywordRankMap = new Map<string, number>();
  keywordRanked.forEach((r, rank) => {
    const id = (r.item.chunkId as string) || (r.item.id as string);
    keywordRankMap.set(id, rank);
  });

  // --- RRF 融合 ---
  const allIds = new Set<string>();
  for (const r of vectorRanked) {
    allIds.add((r.item.chunkId as string) || (r.item.id as string));
  }
  for (const r of keywordRanked) {
    allIds.add((r.item.chunkId as string) || (r.item.id as string));
  }

  const rrfScores = new Map<string, number>();
  for (const id of allIds) {
    let score = 0;
    const vRank = vectorRankMap.get(id);
    if (vRank !== undefined) score += 1 / (RRF_K + vRank);
    const kRank = keywordRankMap.get(id);
    if (kRank !== undefined) score += 1 / (RRF_K + kRank);
    rrfScores.set(id, score);
  }

  // 按 RRF 分数降序排列，取 top-K
  const itemMap = new Map<string, Record<string, unknown>>();
  for (const r of vectorRanked) {
    const id = (r.item.chunkId as string) || (r.item.id as string);
    itemMap.set(id, r.item);
  }

  const sortedIds = [...rrfScores.entries()].sort((a, b) => b[1] - a[1]);

  // 归一化 RRF 分数到 0-1 区间
  const maxRrf = sortedIds[0]?.[1] ?? 1;

  const results: SearchResult[] = [];
  for (const [id, rrfScore] of sortedIds) {
    if (results.length >= topK) break;

    const normalizedScore = maxRrf > 0 ? rrfScore / maxRrf : 0;

    // 应用分数阈值
    if (normalizedScore < scoreThreshold) continue;

    const item = itemMap.get(id);
    if (!item) continue;

    results.push({
      content: (item.text as string) ?? '',
      score: Number(normalizedScore.toFixed(4)),
      chunkId: (item.chunkId as string) ?? '',
      documentId: (item.documentId as string) ?? '',
      filename: (item.filename as string) ?? '',
      knowledgeId: (item.knowledgeId as string) ?? '',
    });
  }

  return results;
}

export async function insertVectors(embeddings: Embeddings, records: VectorRecord[]): Promise<void> {
  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);

  const rows = records.map((r) => ({
    vector: r.vector,
    text: r.text,
    id: r.id,
    chunkId: r.chunkId,
    documentId: r.metadata.documentId,
    filename: r.metadata.filename,
    knowledgeId: r.metadata.knowledgeId,
  }));

  await table.add(rows);
}

export async function deleteVectors(documentId: string): Promise<void> {
  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);
  const safeId = sanitizeId(documentId);
  await table.delete(`documentId = '${safeId}'`);
}

export async function deleteVectorsByKnowledgeId(knowledgeId: string): Promise<void> {
  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);
  const safeId = sanitizeId(knowledgeId);
  await table.delete(`knowledgeId = '${safeId}'`);
}
