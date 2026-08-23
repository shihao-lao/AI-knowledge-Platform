/**
 * 中文关键词提取与匹配（纯函数，不依赖 LanceDB，便于单测）
 */

/**
 * 使用 Intl.Segmenter 进行中文分词 + 停用词过滤（Node.js 内置，无需额外依赖）
 */
const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });

const stopWords = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很',
  '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '吗', '那',
  '么', '什么', '怎么', '如何', '哪些', '哪个', '请', '能', '可以', '被', '把', '给', '让', '用',
  '为', '对', '中',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me',
  'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'what', 'which', 'who',
  'whom', 'how', 'when', 'where', 'why', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
  'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because', 'as', 'until',
  'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'through', 'during',
  'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off',
  'over', 'under', 'again', 'further', 'then', 'once',
]);

export function extractKeywords(query: string): string[] {
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
export function keywordMatchScore(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) hits++;
  }
  return hits / keywords.length;
}
