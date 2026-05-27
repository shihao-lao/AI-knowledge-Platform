import { prisma } from '../utils/prisma.js';
import { KnowledgeBase } from '@prisma/client';

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return prisma.knowledgeBase.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
  return prisma.knowledgeBase.findUnique({ where: { id } });
}

export async function createKnowledgeBase(data: {
  name: string;
  description?: string;
  visibility?: string;
  cozeBotId?: string;
}): Promise<KnowledgeBase> {
  return prisma.knowledgeBase.create({ data });
}

export async function updateKnowledgeBase(
  id: string,
  data: Partial<Pick<KnowledgeBase, 'name' | 'description' | 'visibility' | 'cozeBotId'>>
): Promise<KnowledgeBase> {
  return prisma.knowledgeBase.update({ where: { id }, data });
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  await prisma.knowledgeBase.delete({ where: { id } });
}
