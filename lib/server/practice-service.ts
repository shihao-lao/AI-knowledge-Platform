import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { llmChatStream } from '@/lib/server/llm/client';
import { questionRepo } from '@/lib/db/question-repository';

export class PracticeNotFoundError extends Error {}

export interface EvaluationResult {
  score: number;
  feedback: string;
  keyPoints: string[];
  referenceSummary: string;
}

const EVALUATION_PROMPT = `你是一位面试官，请评估候选人的回答质量。不要输出任何思考过程，直接输出最终结果。

题目：{question}
参考答案：{answer}
候选人回答：{userAnswer}

请严格以 JSON 格式输出（不要输出任何其他内容）：
{"score": 0到100的整数, "feedback": "2-3句中文点评，指出优点与不足", "keyPoints": ["遗漏或薄弱的关键点"], "referenceSummary": "参考答案要点概括"}`;

/** 解析 LLM 评估输出：容忍代码块包裹与前后杂文本 */
export function parseEvaluation(raw: string): EvaluationResult | null {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const score = Math.max(0, Math.min(100, Math.round(Number(obj.score)) || 0));
    return {
      score,
      feedback: String(obj.feedback ?? ''),
      keyPoints: Array.isArray(obj.keyPoints) ? obj.keyPoints.map(String).slice(0, 10) : [],
      referenceSummary: String(obj.referenceSummary ?? ''),
    };
  } catch {
    return null;
  }
}

interface GroupedStat {
  key: string;
  count: number;
  averageScore: number;
}

function groupStats(records: Array<{ score: number; question: { category: string; difficulty: string } }>, field: 'category' | 'difficulty'): GroupedStat[] {
  const map = new Map<string, { sum: number; count: number }>();
  for (const r of records) {
    const key = field === 'category' ? r.question.category : r.question.difficulty;
    const acc = map.get(key) ?? { sum: 0, count: 0 };
    acc.sum += r.score;
    acc.count += 1;
    map.set(key, acc);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, count: v.count, averageScore: Math.round(v.sum / v.count) }))
    .sort((a, b) => b.count - a.count);
}

export const practiceService = {
  /**
   * 评估一道题的作答：LLM 对照参考答案结构化评分，并写入 PracticeRecord
   */
  async evaluate(questionId: string, userId: string, userAnswer: string) {
    const question = await questionRepo.findById(questionId);
    if (!question) throw new PracticeNotFoundError('题目不存在');

    const kb = await prisma.knowledge.findFirst({ where: { id: question.knowledgeId, userId } });
    if (!kb) throw new PracticeNotFoundError('题目不存在');

    // 注意：MiMo 等模型偶发进入深度推理模式，把输出全部耗在 reasoning_content
    // 导致 content 为空，因此评估提示词整体放入 user 消息、用流式收集，并重试。
    let raw = '';
    let result: EvaluationResult | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      raw = '';
      for await (const delta of llmChatStream(
        [
          { role: 'system', content: '你是一位面试官，请严格按用户要求输出。' },
          {
            role: 'user',
            content: EVALUATION_PROMPT.replace('{question}', question.question)
              .replace('{answer}', question.answer)
              .replace('{userAnswer}', userAnswer.slice(0, 4000)),
          },
        ],
        { temperature: 0.2, maxTokens: 1600 },
      )) {
        raw += delta;
      }
      result = parseEvaluation(raw);
      if (result) break;
      console.warn(`[Practice] 评估输出为空或解析失败（attempt ${attempt}），重试... rawLen=${raw.length}`);
    }
    if (!result) {
      console.error('[Practice] 评估解析失败，原始内容:', JSON.stringify(raw).slice(0, 800));
      throw new Error('评估结果解析失败，请重试');
    }

    const record = await prisma.practiceRecord.create({
      data: {
        id: `pr_${crypto.randomUUID().slice(0, 8)}`,
        questionId,
        userId,
        mode: 'question',
        userAnswer: userAnswer.slice(0, 20000),
        score: result.score,
        feedback: result.feedback.slice(0, 2000),
      },
    });

    return { recordId: record.id, ...result };
  },

  /** 掌握度统计：某知识库全部练习记录按类目/难度聚合 */
  async stats(knowledgeId: string) {
    const records = await prisma.practiceRecord.findMany({
      where: { question: { knowledgeId } },
      select: {
        id: true,
        score: true,
        feedback: true,
        mode: true,
        evaluatedAt: true,
        question: { select: { question: true, category: true, difficulty: true } },
      },
      orderBy: { evaluatedAt: 'desc' },
    });

    const total = records.length;
    const averageScore = total > 0 ? Math.round(records.reduce((s, r) => s + r.score, 0) / total) : 0;
    const maxScore = total > 0 ? Math.max(...records.map((r) => r.score)) : 0;
    const minScore = total > 0 ? Math.min(...records.map((r) => r.score)) : 0;

    return {
      total,
      averageScore,
      maxScore,
      minScore,
      byCategory: groupStats(records, 'category'),
      byDifficulty: groupStats(records, 'difficulty'),
      recent: records.slice(0, 10).map((r) => ({
        id: r.id,
        score: r.score,
        question: r.question.question.slice(0, 80),
        category: r.question.category,
        difficulty: r.question.difficulty,
        evaluatedAt: r.evaluatedAt,
      })),
    };
  },
};
