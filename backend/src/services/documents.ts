import { prisma } from '../utils/prisma.js';
import { Document } from '@prisma/client';

export async function listDocuments(kbId: string): Promise<Document[]> {
  return prisma.document.findMany({
    where: { knowledgeBaseId: kbId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDocument(id: string): Promise<Document | null> {
  return prisma.document.findUnique({ where: { id } });
}

export async function createDocument(data: {
  knowledgeBaseId: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  content?: string;
}): Promise<Document> {
  return prisma.document.create({ data });
}

export async function updateDocument(
  id: string,
  data: Partial<Pick<Document, 'title' | 'status' | 'content' | 'chunkCount'>>
): Promise<Document> {
  return prisma.document.update({ where: { id }, data });
}

export async function deleteDocument(id: string): Promise<void> {
  await prisma.document.delete({ where: { id } });
}
