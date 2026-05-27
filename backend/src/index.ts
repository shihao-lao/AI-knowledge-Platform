import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import kbRouter from './routes/kb.js';
import documentsRouter from './routes/documents.js';
import conversationsRouter from './routes/conversations.js';
import chatRouter from './routes/chat.js';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/kb', kbRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/chat', chatRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
