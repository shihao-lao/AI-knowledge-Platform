import { Router, Request, Response } from 'express';
import * as kbService from '../services/kb.js';
import { success, created, notFound, badRequest, error } from '../utils/response.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const kbs = await kbService.listKnowledgeBases();
    success(res, kbs);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, visibility, cozeBotId } = req.body;
    if (!name) {
      return badRequest(res, 'name is required');
    }
    const kb = await kbService.createKnowledgeBase({ name, description, visibility, cozeBotId });
    created(res, kb);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await kbService.getKnowledgeBase(id);
    if (!existing) {
      return notFound(res);
    }
    const kb = await kbService.updateKnowledgeBase(id, req.body);
    success(res, kb);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await kbService.getKnowledgeBase(id);
    if (!existing) {
      return notFound(res);
    }
    await kbService.deleteKnowledgeBase(id);
    success(res, null);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

export default router;
