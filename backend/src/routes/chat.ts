import { Router, Request, Response } from 'express';
import { sendMessage } from '../services/chat.js';
import { badRequest } from '../utils/response.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { conversationId, content } = req.body;

  if (!conversationId || !content?.trim()) {
    return badRequest(res, 'conversationId and content are required');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    await sendMessage(
      conversationId,
      content.trim(),
      (chunk) => {
        res.write(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`);
      },
      (_fullContent) => {
        res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
        res.end();
      },
      (err) => {
        console.error('Chat error:', err);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    );
  } catch (err) {
    console.error('Chat error:', err);
    const message = (err as Error).message || 'Internal Server Error';
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

export default router;
