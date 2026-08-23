import { prisma } from './prisma';
import type { Question } from '@prisma/client';

export interface QuestionCreateInput {
  id: string;
  knowledgeId: string;
  category: string;
  difficulty: string;
  question: string;
  answer: string;
  keywords: string[];
  source?: string;
}

export interface QuestionListParams {
  knowledgeId: string;
  category?: string;
  difficulty?: string;
  keyword?: string;
}

export const questionRepo = {
  async list(params: QuestionListParams): Promise<Question[]> {
    const where: Record<string, unknown> = { knowledgeId: params.knowledgeId };
    if (params.category) where.category = params.category;
    if (params.difficulty) where.difficulty = params.difficulty;
    if (params.keyword) {
      where.OR = [
        { question: { contains: params.keyword } },
        { answer: { contains: params.keyword } },
        { keywords: { contains: params.keyword } },
      ];
    }
    return prisma.question.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  listCategories(knowledgeId: string): Promise<{ category: string }[]> {
    return prisma.question.findMany({
      where: { knowledgeId },
      distinct: ['category'],
      select: { category: true },
    });
  },

  findById(id: string): Promise<Question | null> {
    return prisma.question.findUnique({ where: { id } });
  },

  createMany(data: QuestionCreateInput[]): Promise<{ count: number }> {
    return prisma.question.createMany({
      data: data.map((d) => ({
        ...d,
        keywords: JSON.stringify(d.keywords),
      })),
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.question.delete({ where: { id } });
  },
};
