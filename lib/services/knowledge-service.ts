import { knowledgeRepo } from '@/lib/db/knowledge-repository';
import { deleteVectorsByKnowledgeId } from '@/lib/lancedb/search';

export const knowledgeService = {
  list(userId: string) {
    return knowledgeRepo.list(userId);
  },

  findById(id: string) {
    return knowledgeRepo.findById(id);
  },

  create(userId: string, data: { name: string; description?: string }) {
    const id = `kb_${crypto.randomUUID().slice(0, 8)}`;
    return knowledgeRepo.create({ id, userId, ...data });
  },

  update(id: string, data: { name?: string; description?: string }) {
    return knowledgeRepo.update(id, data);
  },

  async delete(id: string, userId?: string) {
    try {
      await deleteVectorsByKnowledgeId(id, userId);
    } catch {
      /* vector cleanup error is non-fatal */
    }
    await knowledgeRepo.delete(id);
  },
};
