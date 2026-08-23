import { questionRepo } from '@/lib/db/question-repository';
import { prisma } from '@/lib/db/prisma';
import { getEmbeddingProvider, embedBatch } from '@/lib/embedding';
import { insertVectors, deleteVectors } from '@/lib/lancedb/search';
import { ensureTable } from '@/lib/lancedb/client';

export interface ImportQuestion {
  category?: string;
  difficulty?: string;
  question: string;
  answer: string;
  keywords?: string[];
  source?: string;
}

const DIFFICULTIES = ['easy', 'medium', 'hard'];

function newQuestionId(): string {
  return `q_${crypto.randomUUID().slice(0, 8)}`;
}

/** 题目向量文本：题干 + 参考答案；filename 存题干摘要（命中即高权重） */
function questionVectorText(question: ImportQuestion): { text: string; filename: string } {
  const filename = `题目: ${question.question.slice(0, 60)}`;
  const text = `[题目: ${question.question}]\n参考答案：${question.answer}`;
  return { text, filename };
}

export const questionService = {
  async list(knowledgeId: string, params: { category?: string; difficulty?: string; keyword?: string }) {
    return questionRepo.list({ knowledgeId, ...params });
  },

  async categories(knowledgeId: string) {
    const rows = await questionRepo.listCategories(knowledgeId);
    return rows.map((r) => r.category).filter(Boolean);
  },

  /**
   * 批量导入题目：校验 → 落库 → 向量化入 LanceDB（type=question）
   */
  async import(knowledgeId: string, userId: string, items: ImportQuestion[]): Promise<{ count: number }> {
    if (items.length === 0) return { count: 0 };
    if (items.length > 500) {
      throw new Error('单次最多导入 500 道题');
    }

    const normalized = items.map((item) => {
      if (!item || typeof item.question !== 'string' || !item.question.trim()) {
        throw new Error('题目（question）不能为空');
      }
      if (typeof item.answer !== 'string' || !item.answer.trim()) {
        throw new Error(`题目「${item.question.slice(0, 30)}」缺少参考答案（answer）`);
      }
      const difficulty = DIFFICULTIES.includes(item.difficulty ?? '') ? item.difficulty! : 'medium';
      const category = (item.category ?? '未分类').trim().slice(0, 50) || '未分类';
      const keywords = Array.isArray(item.keywords)
        ? item.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 20)
        : [];
      return {
        id: newQuestionId(),
        knowledgeId,
        category,
        difficulty,
        question: item.question.trim().slice(0, 2000),
        answer: item.answer.trim().slice(0, 20000),
        keywords,
        source: item.source?.slice(0, 500) ?? undefined,
      };
    });

    // ① 落库（含 keyword JSON 序列化）
    await questionRepo.createMany(normalized);

    // ② 向量化并写入 LanceDB（失败不影响题目本身落库）
    try {
      await ensureTable();
      const embeddings = await getEmbeddingProvider();
      const texts = normalized.map((n) => questionVectorText(n).text);
      const allVectors: number[][] = [];
      for (let i = 0; i < texts.length; i += 20) {
        const batch = texts.slice(i, i + 20);
        const vectors = await embedBatch(batch);
        allVectors.push(...vectors);
      }
      await insertVectors(
        embeddings,
        normalized.map((n, i) => {
          const { filename } = questionVectorText(n);
          return {
            id: crypto.randomUUID(),
            chunkId: `q_${n.id}`,
            text: texts[i],
            vector: allVectors[i],
            metadata: { userId, knowledgeId, documentId: n.id, filename, type: 'question' as const },
          };
        }),
      );
    } catch (err) {
      console.error('[QuestionService] vector indexing failed (questions kept in DB):', err);
    }

    return { count: normalized.length };
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const question = await questionRepo.findById(id);
    if (!question) return false;
    // 归属校验：题目所属知识库必须属于当前用户
    const kb = await prisma.knowledge.findFirst({ where: { id: question.knowledgeId, userId } });
    if (!kb) return false;

    await deleteVectors(id, userId).catch(() => {});
    await questionRepo.delete(id);
    return true;
  },
};
