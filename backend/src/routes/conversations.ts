import { Router, Request, Response } from 'express';
import * as convService from '../services/conversations.js';
import { success, created, notFound, badRequest, error } from '../utils/response.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { kbId, limit, offset } = req.query;
    const result = await convService.listConversations(
      kbId as string | undefined,
      limit ? parseInt(limit as string, 10) : undefined,
      offset ? parseInt(offset as string, 10) : undefined
    );
    success(res, result);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { knowledgeBaseId, title } = req.body;
    if (!knowledgeBaseId) {
      return badRequest(res, 'knowledgeBaseId is required');
    }
    const conv = await convService.createConversation({ knowledgeBaseId, title });
    created(res, conv);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const conv = await convService.getConversation(id);
    if (!conv) {
      return notFound(res);
    }
    success(res, conv);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await convService.getConversation(id);
    if (!existing) {
      return notFound(res);
    }
    await convService.deleteConversation(id);
    success(res, null);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

export default router;
