import { prisma } from './prisma';
import type { Knowledge, Document, Chunk } from '@prisma/client';

export type KnowledgeWithCount = Knowledge & { _count: { documents: number } };
export type DocumentWithChunks = Document & { chunks: Chunk[] };

export const knowledgeRepo = {
  list(): Promise<KnowledgeWithCount[]> {
    return prisma.knowledge.findMany({
      include: { _count: { select: { documents: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  },

  findById(id: string): Promise<KnowledgeWithCount | null> {
    return prisma.knowledge.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    });
  },

  create(data: { id: string; name: string; description?: string; visibility?: string }): Promise<Knowledge> {
    return prisma.knowledge.create({ data });
  },

  update(id: string, data: { name?: string; description?: string; visibility?: string }): Promise<Knowledge> {
    return prisma.knowledge.update({ where: { id }, data });
  },

  async delete(id: string): Promise<void> {
    await prisma.knowledge.delete({ where: { id } });
  },
};

export const documentRepo = {
  list(knowledgeId: string): Promise<Document[]> {
    return prisma.document.findMany({
      where: { knowledgeId },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string): Promise<DocumentWithChunks | null> {
    return prisma.document.findUnique({
      where: { id },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    });
  },

  create(data: {
    id: string;
    knowledgeId: string;
    filename: string;
    filepath?: string;
    mimeType?: string;
    size?: number;
  }): Promise<Document> {
    return prisma.document.create({ data: { ...data, parseStatus: 'pending' } });
  },

  updateParseStatus(
    id: string,
    data: { parseStatus: string; charCount?: number; chunkCount?: number },
  ): Promise<Document> {
    return prisma.document.update({ where: { id }, data });
  },

  async delete(id: string): Promise<Document> {
    return prisma.document.delete({ where: { id } });
  },
};

export const chunkRepo = {
  listByDocumentId(documentId: string): Promise<Chunk[]> {
    return prisma.chunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });
  },

  createMany(
    chunks: Array<{ id: string; documentId: string; chunkIndex: number; content: string; tokenCount: number }>,
  ) {
    return prisma.chunk.createMany({ data: chunks });
  },

  async deleteByDocumentId(documentId: string): Promise<number> {
    const result = await prisma.chunk.deleteMany({ where: { documentId } });
    return result.count;
  },
};
