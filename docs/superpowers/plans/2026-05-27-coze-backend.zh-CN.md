# Coze 后端实现计划

## 一、项目背景

为 AI 知识库问答平台构建独立的后端服务，集成 Coze API 实现智能对话功能，解决 Next.js 全栈项目中 API 路由与前端耦合过紧的问题。

## 二、核心目标

1. **分离前后端**：将知识库管理、对话逻辑从 Next.js 项目中剥离，独立部署
2. **集成 Coze API**：使用官方 SDK 实现流式对话、知识库管理
3. **数据持久化**：使用 PostgreSQL + Prisma 存储知识库、文档、对话记录
4. **标准化接口**：提供 RESTful API + SSE 流式响应，支持多端接入

## 三、技术选型

| 技术栈 | 选型理由 |
|-------|---------|
| Node.js + TypeScript | 前端团队熟悉，类型安全 |
| Express.js | 轻量级、灵活，适合快速开发 |
| PostgreSQL + Prisma | 企业级数据库，ORM 提高开发效率 |
| Coze API | 官方 SDK 支持流式对话，知识库管理能力强 |
| SSE (Server-Sent Events) | 天然适合 AI 对话流式响应，无需 WebSocket |

## 四、实施计划

### 阶段一：项目初始化与基础架构（1天）

1. **创建项目结构**
   ```bash
   mkdir backend && cd backend
   npm init -y
   npm install express cors dotenv @coze/api @prisma/client
   npm install -D typescript tsx @types/node @types/express @types/cors prisma
   ```

2. **配置 TypeScript**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "commonjs",
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules"]
   }
   ```

3. **初始化 Prisma**
   ```bash
   npx prisma init
   ```

### 阶段二：数据库设计与迁移（1天）

1. **定义数据库模型**
   ```prisma
   // prisma/schema.prisma
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
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
     documents   Document[]
     conversations Conversation[]
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
     createdAt       DateTime @default(now())
     updatedAt       DateTime @updatedAt
     knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])
   }

   model Conversation {
     id              String  @id @default(uuid())
     knowledgeBaseId String
     title           String?
     messageCount    Int     @default(0)
     createdAt       DateTime @default(now())
     updatedAt       DateTime @updatedAt
     knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])
     messages        Message[]
   }

   model Message {
     id              String  @id @default(uuid())
     conversationId  String
     role            String
     content         String
     cozeMessageId   String?
     createdAt       DateTime @default(now())
     conversation    Conversation @relation(fields: [conversationId], references: [id])
   }
   ```

2. **执行数据库迁移**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

### 阶段三：核心 API 开发（2天）

1. **知识库管理 API**
   - GET `/api/kb` - 获取知识库列表
   - POST `/api/kb` - 创建知识库
   - PATCH `/api/kb/:id` - 更新知识库
   - DELETE `/api/kb/:id` - 删除知识库

2. **文档管理 API**
   - GET `/api/documents?kbId=xxx` - 获取指定知识库的文档列表
   - POST `/api/documents` - 上传文档
   - DELETE `/api/documents/:id` - 删除文档

3. **对话管理 API**
   - GET `/api/conversations?kbId=xxx` - 获取对话列表
   - POST `/api/conversations` - 创建对话
   - GET `/api/conversations/:id` - 获取对话详情及消息
   - DELETE `/api/conversations/:id` - 删除对话

### 阶段四：Coze 对话集成（1天）

1. **配置 Coze SDK**
   ```typescript
   // src/services/coze.ts
   import { CozeAPI, RoleType } from '@coze/api';
   import dotenv from 'dotenv';

   dotenv.config();

   export const coze = new CozeAPI({
     token: process.env.COZE_API_KEY!,
     baseURL: process.env.COZE_BASE_URL || 'https://api.coze.com',
   });
   ```

2. **实现流式对话 API**
   ```typescript
   // src/routes/chat.ts
   import { Request, Response } from 'express';
   import { coze } from '../services/coze';
   import { prisma } from '../utils/prisma';

   export async function chatHandler(req: Request, res: Response) {
     const { conversationId, content, userId = 'default_user' } = req.body;

     // 1. 获取对话信息
     const conversation = await prisma.conversation.findUnique({
       where: { id: conversationId },
       include: { knowledgeBase: true, messages: true },
     });

     if (!conversation) {
       return res.status(404).json({ code: 1, message: '对话不存在' });
     }

     // 2. 保存用户消息
     await prisma.message.create({
       data: {
         conversationId,
         role: 'user',
         content,
       },
     });

     // 3. 调用 Coze API 流式对话
     res.setHeader('Content-Type', 'text/event-stream');
     res.setHeader('Cache-Control', 'no-cache');
     res.setHeader('Connection', 'keep-alive');

     try {
       const stream = await coze.chat({
         bot_id: conversation.knowledgeBase.cozeBotId || process.env.COZE_BOT_ID!,
         user_id: userId,
         stream: true,
         auto_save_history: true,
         additional_messages: conversation.messages.map(m => ({
           role: m.role === 'user' ? RoleType.User : RoleType.Assistant,
           content: m.content,
           content_type: 'text',
         })),
       });

       let assistantMessage = '';

       // 4. 流式返回响应
       for await (const chunk of stream) {
         if (chunk.content) {
           assistantMessage += chunk.content;
           res.write(`data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`);
         }
       }

       // 5. 保存助手消息
       await prisma.message.create({
         data: {
           conversationId,
           role: 'assistant',
           content: assistantMessage,
         },
       });

       res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
       res.end();
     } catch (error) {
       console.error('Coze API error:', error);
       res.status(500).json({ code: 1, message: '对话失败' });
     }
   }
   ```

### 阶段五：错误处理与优化（0.5天）

1. **全局错误中间件**
   ```typescript
   // src/middleware/error.ts
   import { Request, Response, NextFunction } from 'express';

   export function errorHandler(
     err: any,
     req: Request,
     res: Response,
     next: NextFunction
   ) {
     console.error(err.stack);

     const status = err.status || 500;
     const message = err.message || '服务器内部错误';

     res.status(status).json({
       code: 1,
       data: null,
       message,
     });
   }
   ```

2. **API 响应格式化**
   ```typescript
   // src/utils/response.ts
   export function successResponse<T>(data: T, message?: string) {
     return {
       code: 0,
       data,
       message: message || '操作成功',
     };
   }

   export function errorResponse(message: string, code = 1) {
     return {
       code,
       data: null,
       message,
     };
   }
   ```

### 阶段六：前端对接与测试（0.5天）

1. **更新前端 API 配置**
   ```typescript
   // lib/api.ts
   const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

   export const api = {
     kb: {
       list: () => fetch(`${API_BASE}/api/kb`).then(res => res.json()),
       create: (data: any) => fetch(`${API_BASE}/api/kb`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }).then(res => res.json()),
       // ... 其他接口
     },
     chat: {
       send: (data: any) => {
         const eventSource = new EventSource(`${API_BASE}/api/chat`, { withCredentials: true });
         // ... 处理流式响应
       },
     },
   };
   ```

2. **测试所有功能**
   - 知识库增删改查
   - 文档上传与管理
   - 对话流式响应
   - 错误场景处理

## 五、部署计划

1. **本地开发**
   ```bash
   npm run dev  # tsx watch src/index.ts
   ```

2. **生产构建**
   ```bash
   npm run build  # tsc
   npm start      # node dist/index.js
   ```

3. **容器化部署**
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   npm install --production
   COPY dist ./dist
   COPY prisma ./prisma
   RUN npx prisma generate
   EXPOSE 3001
   CMD ["npm", "start"]
   ```

## 六、风险评估

| 风险 | 应对措施 |
|-----|---------|
| Coze API 调用失败 | 实现重试机制，降级为本地知识库查询 |
| 数据库连接异常 | 配置连接池，实现自动重连 |
| 流式响应中断 | 前端实现重连机制，记录对话上下文 |
| 性能瓶颈 | 实现批量处理、缓存策略，优化数据库查询 |

## 七、后续规划

1. **权限系统**：集成 JWT/OAuth2，支持多用户管理
2. **文档处理**：支持 PDF/Word 解析，自动分块与向量存储
3. **知识库同步**：实现本地知识库与 Coze 知识库双向同步
4. **监控告警**：集成 Prometheus + Grafana，监控系统状态
5. **多模型支持**：扩展支持 OpenAI、Anthropic 等其他大模型