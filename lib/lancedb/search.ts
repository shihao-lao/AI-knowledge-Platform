import { getLanceDB } from './client';
import { VECTOR_TABLE_NAME, type VectorRecord } from './schema';

function sanitizeId(id: string): string {
  if (!/^[\w.-]+$/.test(id)) {
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
  excludeDocumentIds?: string[];
}

export interface SearchResult {
  content: string;
  score: number;
  chunkId: string;
  chunkIndex: number;
  documentId: string;
  filename: string;
  knowledgeId: string;
}

/** Reciprocal Rank Fusion 常量 */
const RRF_K = 60;

/**
 * 使用 Intl.Segmenter 进行中文分词 + 停用词过滤（Node.js 内置，无需额外依赖）
 */
const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });

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
  '被',
  '把',
  '给',
  '让',
  '用',
  '为',
  '对',
  '中',
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

function extractKeywords(query: string): string[] {
  const lower = query.toLowerCase();

  // 1. Intl.Segmenter 分词
  const segmented = [...segmenter.segment(lower)]
    .filter((s) => s.isWordLike && s.segment.trim().length > 0)
    .map((s) => s.segment);

  // 2. 从 segmenter 产生的中文单字重建 bigram（修复"监控"→"监"+"控"→"监控"）
  const cjkUnigrams = segmented.filter((t) => /^[一-鿿]$/.test(t));
  const reconstructed: string[] = [];
  for (let i = 0; i < cjkUnigrams.length - 1; i++) {
    reconstructed.push(cjkUnigrams[i] + cjkUnigrams[i + 1]);
  }

  // 3. 合并去重，过滤停用词
  const all = [...segmented, ...reconstructed];
  return [...new Set(all.filter((t) => !stopWords.has(t) && t.length >= 2))];
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
export async function searchKnowledge(
  embeddings: { embedQuery(text: string): Promise<number[]> },
  params: SearchParams,
): Promise<SearchResult[]> {
  const { query, topK = 10, scoreThreshold = 0.2, knowledgeId, excludeDocumentIds } = params;

  const queryEmbedding = await embeddings.embedQuery(query);
  const keywords = extractKeywords(query);

  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);

  // 扩大候选池：topK * 20 或至少 100
  const candidateLimit = Math.max(topK * 20, 100);
  const queryBuilder = table.query().nearestTo(queryEmbedding).limit(candidateLimit);

  // 构建 WHERE 条件
  const conditions: string[] = [];
  if (knowledgeId) {
    const safeId = sanitizeId(knowledgeId);
    conditions.push(`knowledgeId = '${safeId}'`);
  }
  // 排除禁用文档的切片
  if (excludeDocumentIds && excludeDocumentIds.length > 0) {
    const safeIds = excludeDocumentIds.map(sanitizeId);
    conditions.push(`documentId NOT IN (${safeIds.map((id) => `'${id}'`).join(',')})`);
  }
  if (conditions.length > 0) {
    queryBuilder.where(conditions.join(' AND '));
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
            score: Math.max(
              keywordMatchScore((item.text as string) ?? '', keywords),
              keywordMatchScore((item.filename as string) ?? '', keywords),
            ),
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

  // 按 RRF 分数降序排列
  // 同时保存 distance 信息用于计算相似度
  const itemWithDistanceMap = new Map<string, { item: Record<string, unknown>; distance: number }>();
  for (const r of vectorRanked) {
    const id = (r.item.chunkId as string) || (r.item.id as string);
    itemWithDistanceMap.set(id, { item: r.item, distance: r.distance });
  }

  const sortedIds = [...rrfScores.entries()].sort((a, b) => b[1] - a[1]);

  // 计算绝对相似度：结合向量距离和关键词匹配
  const candidates: { id: string; score: number; item: Record<string, unknown> }[] = [];
  for (const [id] of sortedIds) {
    const entry = itemWithDistanceMap.get(id);
    if (!entry) continue;
    const { item, distance } = entry;

    // 向量距离转相似度（L2 归一化向量的精确公式：cos(θ) = 1 - d²/2）
    const vectorSimilarity = Math.max(0, 1 - (distance * distance) / 2);

    // 关键词匹配：分别计算内容和文件名的匹配度
    const contentKeywordScore = keywordMatchScore((item.text as string) ?? '', keywords);
    const filenameKeywordScore = keywordMatchScore((item.filename as string) ?? '', keywords);
    const keywordScore = Math.max(contentKeywordScore, filenameKeywordScore);

    // 文件名关键词高度命中 → 直接判定高度相关（用户明确在问某个文档）
    const FILENAME_BOOST_THRESHOLD = 0.6;
    if (filenameKeywordScore >= FILENAME_BOOST_THRESHOLD) {
      candidates.push({ id, score: Math.max(0.85, vectorSimilarity), item });
      continue;
    }

    // 综合分数：向量 80%，关键词 20%
    const absoluteScore = keywords.length > 0 ? vectorSimilarity * 0.8 + keywordScore * 0.2 : vectorSimilarity;

    if (absoluteScore < scoreThreshold) continue;
    candidates.push({ id, score: absoluteScore, item });
  }

  // 文档级去重：同一文档保留 top-3 chunk（避免丢失正确答案）
  const chunksPerDoc = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const docId = (c.item.documentId as string) ?? c.id;
    const arr = chunksPerDoc.get(docId) ?? [];
    arr.push(c);
    chunksPerDoc.set(docId, arr);
  }
  const dedupedCandidates = [...chunksPerDoc.values()]
    .flatMap((arr) => arr.sort((a, b) => b.score - a.score).slice(0, 3))
    .sort((a, b) => b.score - a.score);

  // 自适应截断：过滤低质量结果
  const MIN_TOP_SCORE = 0.15;
  const CLIFF_RATIO = 0.5;
  if (dedupedCandidates.length === 0 || dedupedCandidates[0].score < MIN_TOP_SCORE) return [];

  const results: SearchResult[] = [];
  for (const c of dedupedCandidates) {
    if (results.length >= topK) break;
    // 分数断崖：如果比前一条低 50% 以上，截断
    if (results.length > 0 && c.score < results[results.length - 1].score * CLIFF_RATIO) break;
    results.push({
      content: (c.item.text as string) ?? '',
      score: Number(Math.min(c.score, 1).toFixed(4)),
      chunkId: (c.item.chunkId as string) ?? '',
      chunkIndex: Number(c.item.chunkIndex ?? 0),
      documentId: (c.item.documentId as string) ?? '',
      filename: (c.item.filename as string) ?? '',
      knowledgeId: (c.item.knowledgeId as string) ?? '',
    });
  }

  return results;
}

export async function insertVectors(_embeddings: unknown, records: VectorRecord[]): Promise<void> {
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
