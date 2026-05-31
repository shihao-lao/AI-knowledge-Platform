import { knowledgeRepo, documentRepo, chunkRepo } from '@/lib/db/knowledge-repository';
import { deleteVectorsByKnowledgeId } from '@/lib/lancedb/search';

export const knowledgeService = {
  list() {
    return knowledgeRepo.list();
  },

  findById(id: string) {
    return knowledgeRepo.findById(id);
  },

  create(data: { name: string; description?: string; visibility?: string }) {
    const id = `kb_${crypto.randomUUID().slice(0, 8)}`;
    return knowledgeRepo.create({ id, ...data });
  },

  update(id: string, data: { name?: string; description?: string; visibility?: string }) {
    return knowledgeRepo.update(id, data);
  },

  async delete(id: string) {
    const docs = await documentRepo.list(id);
    try {
      await deleteVectorsByKnowledgeId(id);
    } catch {
      /* vector cleanup error is non-fatal */
    }
    await knowledgeRepo.delete(id);
  },
};
