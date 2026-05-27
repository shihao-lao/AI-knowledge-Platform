# Coze Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Express.js backend that integrates with Coze API to provide knowledge base and AI conversation functionality.

**Architecture:** Express.js server with PostgreSQL (Prisma ORM) for data storage and Coze SDK for AI chat integration. The backend runs independently on port 3001, connecting to the Next.js frontend on port 3000 via CORS.

**Tech Stack:** Node.js, TypeScript, Express.js, PostgreSQL, Prisma, Coze SDK (`@coze/api`)

---

## File Structure

```
backend/
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── .env                            # Environment variables
├── prisma/
│   └── schema.prisma               # Database schema
├── src/
│   ├── index.ts                    # Express server entry point
│   ├── config/
│   │   └── index.ts                # Environment config loader
│   ├── routes/
│   │   ├── kb.ts                   # Knowledge base CRUD routes
│   │   ├── documents.ts            # Document CRUD routes
│   │   ├── conversations.ts        # Conversation CRUD routes
│   │   └── chat.ts                 # Chat with Coze (SSE streaming)
│   ├── services/
│   │   ├── coze.ts                 # Coze API client wrapper
│   │   ├── kb.ts                   # Knowledge base business logic
│   │   ├── documents.ts            # Document business logic
│   │   └── chat.ts                 # Chat business logic
│   ├── middleware/
│   │   └── error.ts                # Error handling middleware
│   └── utils/
│       └── response.ts             # Standard response helpers
```

---

## Task 1: Initialize Project

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env`
- Create: `backend/src/index.ts`
- Create: `backend/src/config/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "ai-knowledge-backend",
  "version": "1.0.0",
  "description": "Backend for AI Knowledge Base Q&A Platform",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@coze/api": "^1.0.0",
    "@prisma/client": "^6.0.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "prisma": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create .env**

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_knowledge"

# Coze API
COZE_API_KEY="your_coze_api_key"
COZE_BASE_URL="https://api.coze.com"
COZE_BOT_ID="your_default_bot_id"
DEFAULT_USER_ID="default_user"

# Server
PORT=3001
CORS_ORIGIN="http://localhost:3000"
```

- [ ] **Step 4: Create src/config/index.ts**

```typescript
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL!,
  coze: {
    apiKey: process.env.COZE_API_KEY || '',
    baseUrl: process.env.COZE_BASE_URL || 'https://api.coze.com',
    defaultBotId: process.env.COZE_BOT_ID || '',
  },
  defaultUserId: process.env.DEFAULT_USER_ID || 'default_user',
};
```

- [ ] **Step 5: Create src/index.ts (minimal server)**

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
```

- [ ] **Step 6: Install dependencies and verify**

Run: `cd backend && npm install`
Expected: Dependencies installed successfully

Run: `cd backend && npx tsx src/index.ts`
Expected: Server starts on port 3001

Run: `curl http://localhost:3001/health`
Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: initialize Express.js backend project"
```

---

## Task 2: Set Up Prisma and Database Schema

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/utils/prisma.ts`

- [ ] **Step 1: Create prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model KnowledgeBase {
  id          String   @id @default(uuid())
  name        String
  description String?
  visibility  String   @default("private")
  cozeBotId   String?

  documents     Document[]
  conversations Conversation[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Document {
  id              String  @id @default(uuid())
  knowledgeBaseId String
  title           String
  fileName        String
  fileType        String
  fileSize        Int
  status          String  @default("uploading")
  content         String?
  chunkCount      Int     @default(0)

  knowledgeBase KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Conversation {
  id              String  @id @default(uuid())
  knowledgeBaseId String
  title           String?
  messageCount    Int     @default(0)

  knowledgeBase KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])
  messages      Message[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Message {
  id             String  @id @default(uuid())
  conversationId String
  role           String
  content        String
  cozeMessageId  String?

  conversation Conversation @relation(fields: [conversationId], references: [id])

  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Create src/utils/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 3: Generate Prisma client**

Run: `cd backend && npx prisma generate`
Expected: Prisma client generated successfully

- [ ] **Step 4: Push schema to database**

Run: `cd backend && npx prisma db push`
Expected: Schema pushed to PostgreSQL (requires running PostgreSQL instance)

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/ backend/src/utils/prisma.ts
git commit -m "feat: add Prisma schema and database setup"
```

---

## Task 3: Create Response Utilities and Error Middleware

**Files:**
- Create: `backend/src/utils/response.ts`
- Create: `backend/src/middleware/error.ts`

- [ ] **Step 1: Create src/utils/response.ts**

```typescript
import { Response } from 'express';

export interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

export function success<T>(res: Response, data: T): void {
  res.json({ code: 0, data });
}

export function created<T>(res: Response, data: T): void {
  res.status(201).json({ code: 0, data });
}

export function error(res: Response, message: string, status = 500): void {
  res.status(status).json({ code: 1, data: null, message });
}

export function notFound(res: Response, message = 'Resource not found'): void {
  error(res, message, 404);
}

export function badRequest(res: Response, message = 'Bad request'): void {
  error(res, message, 400);
}
```

- [ ] **Step 2: Create src/middleware/error.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import { error as errorResponse } from '../utils/response.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err.stack);
  const status = (err as any).status || 500;
  const message = err.message || 'Internal Server Error';
  errorResponse(res, message, status);
}

export function notFoundHandler(_req: Request, res: Response): void {
  errorResponse(res, 'Route not found', 404);
}
```

- [ ] **Step 3: Update src/index.ts to use middleware**

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
```

- [ ] **Step 4: Verify server starts**

Run: `cd backend && npx tsx src/index.ts`
Expected: Server starts without errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/response.ts backend/src/middleware/error.ts backend/src/index.ts
git commit -m "feat: add response utilities and error middleware"
```

---

## Task 4: Knowledge Base Service and Routes

**Files:**
- Create: `backend/src/services/kb.ts`
- Create: `backend/src/routes/kb.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create src/services/kb.ts**

```typescript
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
```

- [ ] **Step 2: Create src/routes/kb.ts**

```typescript
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

router.patch('/:id', async (req: Request, res: Response) => {
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

router.delete('/:id', async (req: Request, res: Response) => {
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
```

- [ ] **Step 3: Update src/index.ts to use kb routes**

Add import and route registration:
```typescript
import kbRouter from './routes/kb.js';

// After app declaration, before middleware
app.use('/api/kb', kbRouter);
```

- [ ] **Step 4: Test KB routes manually**

Run: `cd backend && npx tsx src/index.ts`

Test create:
```bash
curl -X POST http://localhost:3001/api/kb \
  -H "Content-Type: application/json" \
  -d '{"name": "Test KB", "description": "Test"}'
```
Expected: `{"code":0,"data":{"id":"...","name":"Test KB",...}}`

Test list:
```bash
curl http://localhost:3001/api/kb
```
Expected: `{"code":0,"data":[...]}`

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/kb.ts backend/src/routes/kb.ts backend/src/index.ts
git commit -m "feat: add knowledge base CRUD routes"
```

---

## Task 5: Document Service and Routes

**Files:**
- Create: `backend/src/services/documents.ts`
- Create: `backend/src/routes/documents.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create src/services/documents.ts**

```typescript
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
```

- [ ] **Step 2: Create src/routes/documents.ts**

```typescript
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

router.delete('/:id', async (req: Request, res: Response) => {
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
```

- [ ] **Step 3: Update src/index.ts to use documents routes**

Add import and route registration:
```typescript
import documentsRouter from './routes/documents.js';

app.use('/api/documents', documentsRouter);
```

- [ ] **Step 4: Test Document routes manually**

Run: `cd backend && npx tsx src/index.ts`

Test create:
```bash
curl -X POST http://localhost:3001/api/documents \
  -H "Content-Type: application/json" \
  -d '{"knowledgeBaseId": "test-kb-id", "title": "Test Doc", "fileName": "test.md", "fileType": "markdown", "fileSize": 100}'
```

Test list:
```bash
curl "http://localhost:3001/api/documents?kbId=test-kb-id"
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/documents.ts backend/src/routes/documents.ts backend/src/index.ts
git commit -m "feat: add document CRUD routes"
```

---

## Task 6: Conversation Service and Routes

**Files:**
- Create: `backend/src/services/conversations.ts`
- Create: `backend/src/routes/conversations.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create src/services/conversations.ts**

```typescript
import { prisma } from '../utils/prisma.js';
import { Conversation, Message } from '@prisma/client';

export async function listConversations(
  kbId?: string,
  limit = 20,
  offset = 0
): Promise<{ items: Conversation[]; total: number }> {
  const where = kbId ? { knowledgeBaseId: kbId } : {};
  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.conversation.count({ where }),
  ]);
  return { items, total };
}

export async function getConversation(id: string): Promise<(Conversation & { messages: Message[] }) | null> {
  return prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function createConversation(data: {
  knowledgeBaseId: string;
  title?: string;
}): Promise<Conversation> {
  return prisma.conversation.create({ data });
}

export async function deleteConversation(id: string): Promise<void> {
  await prisma.conversation.delete({ where: { id } });
}

export async function updateConversation(
  id: string,
  data: Partial<Pick<Conversation, 'title' | 'messageCount'>>
): Promise<Conversation> {
  return prisma.conversation.update({ where: { id }, data });
}

export async function addMessages(
  conversationId: string,
  messages: Array<{ role: string; content: string; cozeMessageId?: string }>
): Promise<Message[]> {
  const created = await prisma.message.createMany({
    data: messages.map((m) => ({ ...m, conversationId })),
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { messageCount: { increment: messages.length } },
  });

  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
}
```

- [ ] **Step 2: Create src/routes/conversations.ts**

```typescript
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

router.get('/:id', async (req: Request, res: Response) => {
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

router.delete('/:id', async (req: Request, res: Response) => {
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
```

- [ ] **Step 3: Update src/index.ts to use conversations routes**

Add import and route registration:
```typescript
import conversationsRouter from './routes/conversations.js';

app.use('/api/conversations', conversationsRouter);
```

- [ ] **Step 4: Test Conversation routes manually**

Run: `cd backend && npx tsx src/index.ts`

Test create:
```bash
curl -X POST http://localhost:3001/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"knowledgeBaseId": "test-kb-id", "title": "Test Conversation"}'
```

Test list:
```bash
curl "http://localhost:3001/api/conversations?kbId=test-kb-id"
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/conversations.ts backend/src/routes/conversations.ts backend/src/index.ts
git commit -m "feat: add conversation CRUD routes"
```

---

## Task 7: Coze Service Integration

**Files:**
- Create: `backend/src/services/coze.ts`

- [ ] **Step 1: Create src/services/coze.ts**

```typescript
import { CozeAPI, ChatEventType, RoleType } from '@coze/api';
import { config } from '../config/index.js';

let cozeClient: CozeAPI | null = null;

function getCozeClient(): CozeAPI {
  if (!cozeClient) {
    cozeClient = new CozeAPI({
      token: config.coze.apiKey,
      baseURL: config.coze.baseUrl,
    });
  }
  return cozeClient;
}

export interface CozeStreamCallbacks {
  onMessage: (content: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamChat(
  botId: string,
  userId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  callbacks: CozeStreamCallbacks
): Promise<void> {
  const client = getCozeClient();

  try {
    const stream = await client.chat({
      bot_id: botId,
      user_id: userId,
      stream: true,
      auto_save_history: true,
      additional_messages: messages.map((m) => ({
        role: m.role === 'user' ? RoleType.User : RoleType.Assistant,
        content: m.content,
        content_type: 'text',
      })),
    });

    for await (const event of stream) {
      if (event.event === ChatEventType.CONVERSATION_MESSAGE_DELTA) {
        callbacks.onMessage(event.data.content);
      } else if (event.event === ChatEventType.CONVERSATION_CHAT_COMPLETED) {
        callbacks.onDone();
      }
    }
  } catch (err) {
    callbacks.onError(err as Error);
  }
}

export function getDefaultBotId(): string {
  return config.coze.defaultBotId;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/coze.ts
git commit -m "feat: add Coze API service integration"
```

---

## Task 8: Chat Route with SSE Streaming

**Files:**
- Create: `backend/src/routes/chat.ts`
- Create: `backend/src/services/chat.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create src/services/chat.ts**

```typescript
import * as convService from './conversations.js';
import * as kbService from './kb.js';
import * as cozeService from './coze.js';
import { config } from '../config/index.js';

export async function sendMessage(
  conversationId: string,
  content: string,
  onChunk: (chunk: string) => void,
  onDone: (fullContent: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  // Load conversation
  const conversation = await convService.getConversation(conversationId);
  if (!conversation) {
    throw Object.assign(new Error('Conversation not found'), { status: 404 });
  }

  // Load knowledge base to get bot ID
  const kb = await kbService.getKnowledgeBase(conversation.knowledgeBaseId);
  if (!kb) {
    throw Object.assign(new Error('Knowledge base not found'), { status: 404 });
  }

  const botId = kb.cozeBotId || cozeService.getDefaultBotId();
  if (!botId) {
    throw Object.assign(new Error('No bot ID configured'), { status: 500 });
  }

  // Save user message
  await convService.addMessages(conversationId, [
    { role: 'user', content },
  ]);

  // Load message history
  const messages = await convService.getMessages(conversationId);
  const history = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Stream from Coze
  let fullContent = '';

  await cozeService.streamChat(botId, config.defaultUserId, history, {
    onMessage: (chunk) => {
      fullContent += chunk;
      onChunk(chunk);
    },
    onDone: async () => {
      // Save assistant message
      await convService.addMessages(conversationId, [
        { role: 'assistant', content: fullContent },
      ]);
      onDone(fullContent);
    },
    onError: (err) => {
      onError(err);
    },
  });
}
```

- [ ] **Step 2: Create src/routes/chat.ts**

```typescript
import { Router, Request, Response } from 'express';
import { sendMessage } from '../services/chat.js';
import { badRequest, error } from '../utils/response.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { conversationId, content } = req.body;

  if (!conversationId || !content?.trim()) {
    return badRequest(res, 'conversationId and content are required');
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    await sendMessage(
      conversationId,
      content.trim(),
      // onChunk
      (chunk) => {
        res.write(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`);
      },
      // onDone
      (_fullContent) => {
        res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
        res.end();
      },
      // onError
      (err) => {
        console.error('Chat error:', err);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    );
  } catch (err) {
    console.error('Chat error:', err);
    const status = (err as any).status || 500;
    const message = (err as Error).message || 'Internal Server Error';
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

export default router;
```

- [ ] **Step 3: Update src/index.ts to use chat routes**

Add import and route registration:
```typescript
import chatRouter from './routes/chat.js';

app.use('/api/chat', chatRouter);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/chat.ts backend/src/services/chat.ts backend/src/index.ts
git commit -m "feat: add chat route with SSE streaming via Coze"
```

---

## Task 9: Final Integration and Testing

**Files:**
- Modify: `backend/src/index.ts` (verify all routes registered)
- Create: `backend/README.md`

- [ ] **Step 1: Verify src/index.ts has all routes**

Ensure `src/index.ts` includes:
```typescript
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
```

- [ ] **Step 2: Full TypeScript check**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Create README.md**

```markdown
# AI Knowledge Backend

Express.js backend for AI Knowledge Base Q&A Platform with Coze API integration.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your database and Coze API credentials
   ```

3. Set up database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/kb` | List knowledge bases |
| POST | `/api/kb` | Create knowledge base |
| PATCH | `/api/kb/:id` | Update knowledge base |
| DELETE | `/api/kb/:id` | Delete knowledge base |
| GET | `/api/documents?kbId=xxx` | List documents |
| POST | `/api/documents` | Create document |
| DELETE | `/api/documents/:id` | Delete document |
| GET | `/api/conversations?kbId=xxx` | List conversations |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations/:id` | Get conversation with messages |
| DELETE | `/api/conversations/:id` | Delete conversation |
| POST | `/api/chat` | Send message (SSE stream) |
```

- [ ] **Step 4: Final commit**

```bash
git add backend/
git commit -m "feat: complete Coze backend integration"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|------------------|------|
| Project structure | Task 1 |
| Database schema | Task 2 |
| Error handling | Task 3 |
| KB CRUD routes | Task 4 |
| Document CRUD routes | Task 5 |
| Conversation CRUD routes | Task 6 |
| Coze SDK integration | Task 7 |
| Chat SSE streaming | Task 8 |
| Response format | Task 3 |
| Environment variables | Task 1 |
| CORS configuration | Task 1 |

All spec requirements are covered.
