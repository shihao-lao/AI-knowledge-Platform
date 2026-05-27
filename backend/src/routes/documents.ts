import { Router, Request, Response } from 'express';
import * as docService from '../services/documents.js';
import { success, created, notFound, badRequest, error } from '../utils/response.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { kbId } = req.query;
    if (!kbId || typeof kbId !== 'string') {
      return badRequest(res, 'kbId query parameter is required');
    }
    const docs = await docService.listDocuments(kbId);
    success(res, docs);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { knowledgeBaseId, title, fileName, fileType, fileSize, content } = req.body;
    if (!knowledgeBaseId || !title || !fileName || !fileType || fileSize === undefined) {
      return badRequest(res, 'knowledgeBaseId, title, fileName, fileType, and fileSize are required');
    }
    const doc = await docService.createDocument({
      knowledgeBaseId,
      title,
      fileName,
      fileType,
      fileSize,
      content,
    });
    created(res, doc);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await docService.getDocument(id);
    if (!existing) {
      return notFound(res);
    }
    await docService.deleteDocument(id);
    success(res, null);
  } catch (err) {
    error(res, (err as Error).message);
  }
});

export default router;
