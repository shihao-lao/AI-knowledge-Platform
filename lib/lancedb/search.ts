import { getLanceDB } from './client';
import { Index } from '@lancedb/lancedb';
import type { Table } from '@lancedb/lancedb';
import { VECTOR_TABLE_NAME, type VectorRecord } from './schema';
import { extractKeywords, keywordMatchScore } from './keywords';

/**
 * 严格校验 ID 格式（服务端生成的 ID 形如 `kb_xxxxxxxx` / `doc_xxxxxxxx`）。
 * 只允许字母、数字、下划线，杜绝注入 LanceDB SQL 过滤串的可能。
 * 校验失败直接抛错（fail-closed），绝不静默放行。
 */
function sanitizeId(id: string): string {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_]+$/.test(id)) {
    throw new Error('Invalid ID format');
  }
  return id;
}

export interface SearchParams {
  query: string;
  /** 数据归属用户，多用户隔离的强制条件 */
  userId?: string;
  knowledgeId?: string;
  /** 限定检索类型：doc=文档切片，question=面试题目 */
  type?: 'doc' | 'question';
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

/** FTS 索引是否已确认存在（进程内缓存，避免每次查询都 listIndices） */
let ftsIndexChecked = false;

/**
 * 确保 text 列存在 FTS（BM25）索引；中文使用 ngram tokenizer（2-3 字切分）。
 * 索引创建失败不抛错，调用方回退到旧的关键词打分。
 */
async function ensureFtsIndex(table: Table): Promise<void> {
  if (ftsIndexChecked) return;
  ftsIndexChecked = true;
  try {
    const indices = await table.listIndices();
    const hasFts = indices.some(
      (i) =>
        (i.indexType ?? '').toUpperCase().includes('FTS') ||
        (Array.isArray(i.columns) && i.columns.includes('text')),
    );
    if (hasFts) return;
    await table.createIndex('text', {
      config: Index.fts({
        baseTokenizer: 'ngram',
        ngramMinLength: 2,
        ngramMaxLength: 3,
        lowercase: true,
        removeStopWords: false,
      }),
      replace: true,
      waitTimeoutSeconds: 120,
    });
    console.log('[Search] FTS index created on text column');
  } catch (err) {
    console.warn('[Search] FTS index unavailable, falling back to keyword scoring:', err);
  }
}

function rowId(item: Record<string, unknown>): string {
  return (item.chunkId as string) || (item.id as string);
}

/**
 * 混合搜索：向量语义搜索 + 关键词匹配，通过 RRF 融合排名
 */
export async function searchKnowledge(
  embeddings: { embedQuery(text: string): Promise<number[]> },
  params: SearchParams,
): Promise<SearchResult[]> {
  const { query, topK = 10, scoreThreshold = 0.2, userId, knowledgeId, type, excludeDocumentIds } = params;

  const queryEmbedding = await embeddings.embedQuery(query);
  const keywords = extractKeywords(query);

  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);

  // 扩大候选池：topK * 20 或至少 100
  const candidateLimit = Math.max(topK * 20, 100);
  const queryBuilder = table.query().nearestTo(queryEmbedding).limit(candidateLimit);

  // 构建 WHERE 条件
  const conditions: string[] = [];
  // 用户隔离：永远先按 userId 过滤（配合知识库归属校验，双保险）
  if (userId) {
    const safeUserId = sanitizeId(userId);
    conditions.push(`userId = '${safeUserId}'`);
  }
  if (knowledgeId) {
    const safeId = sanitizeId(knowledgeId);
    conditions.push(`knowledgeId = '${safeId}'`);
  }
  if (type) {
    const safeType = type === 'question' ? 'question' : 'doc';
    conditions.push(`type = '${safeType}'`);
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
    vectorRankMap.set(rowId(r.item), rank);
  });

  // --- FTS（BM25）排名：优先使用，索引不可用时回退旧关键词打分 ---
  let ftsRanked: Record<string, unknown>[] = [];
  try {
    await ensureFtsIndex(table);
    const ftsQuery = table.search(query, 'fts', ['text']).limit(candidateLimit);
    if (conditions.length > 0) {
      ftsQuery.where(conditions.join(' AND '));
    }
    ftsRanked = (await ftsQuery.toArray()) as Record<string, unknown>[];
  } catch (err) {
    console.warn('[Search] FTS query failed, using keyword fallback:', err);
  }

  const keywordRanked =
    ftsRanked.length === 0 && keywords.length > 0
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

  const ftsRankMap = new Map<string, number>();
  ftsRanked.forEach((item, rank) => {
    ftsRankMap.set(rowId(item), rank);
  });

  const keywordRankMap = new Map<string, number>();
  keywordRanked.forEach((r, rank) => {
    keywordRankMap.set(rowId(r.item), rank);
  });

  // --- RRF 融合 ---
  const allIds = new Set<string>();
  for (const r of vectorRanked) {
    allIds.add(rowId(r.item));
  }
  for (const item of ftsRanked) {
    allIds.add(rowId(item));
  }
  for (const r of keywordRanked) {
    allIds.add(rowId(r.item));
  }

  const rrfScores = new Map<string, number>();
  for (const id of allIds) {
    let score = 0;
    const vRank = vectorRankMap.get(id);
    if (vRank !== undefined) score += 1 / (RRF_K + vRank);
    const fRank = ftsRankMap.get(id);
    if (fRank !== undefined) score += 1 / (RRF_K + fRank);
    const kRank = keywordRankMap.get(id);
    if (kRank !== undefined) score += 1 / (RRF_K + kRank);
    rrfScores.set(id, score);
  }

  // 按 RRF 分数降序排列
  // 同时保存 distance 信息用于计算相似度
  const itemWithDistanceMap = new Map<string, { item: Record<string, unknown>; distance: number }>();
  for (const r of vectorRanked) {
    itemWithDistanceMap.set(rowId(r.item), { item: r.item, distance: r.distance });
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
    userId: r.metadata.userId,
    documentId: r.metadata.documentId,
    filename: r.metadata.filename,
    knowledgeId: r.metadata.knowledgeId,
    type: r.metadata.type,
  }));

  await table.add(rows);
}

export async function deleteVectors(documentId: string, userId?: string): Promise<void> {
  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);
  const safeId = sanitizeId(documentId);
  const conditions = [`documentId = '${safeId}'`];
  if (userId) {
    conditions.push(`userId = '${sanitizeId(userId)}'`);
  }
  await table.delete(conditions.join(' AND '));
}

export async function deleteVectorsByKnowledgeId(knowledgeId: string, userId?: string): Promise<void> {
  const db = await getLanceDB();
  const table = await db.openTable(VECTOR_TABLE_NAME);
  const safeId = sanitizeId(knowledgeId);
  const conditions = [`knowledgeId = '${safeId}'`];
  if (userId) {
    conditions.push(`userId = '${sanitizeId(userId)}'`);
  }
  await table.delete(conditions.join(' AND '));
}
