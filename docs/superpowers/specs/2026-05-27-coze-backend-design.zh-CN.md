# Coze 后端设计规范

## 一、概述

为 AI 知识库问答平台构建独立的 Express.js 后端服务，集成 Coze API 提供知识库管理与 AI 对话功能。

**第一阶段（当前）**：集成 Coze 对话 API
**第二阶段（未来）**：通过 Coze API 实现知识库管理

## 二、技术栈

- **运行环境**：Node.js + TypeScript
- **Web 框架**：Express.js
- **数据库**：PostgreSQL + Prisma ORM
- **AI 集成**：Coze 官方 SDK (`@coze/api`)
- **跨域支持**：允许来自 `http://localhost:3000` 的前端请求

## 三、项目结构

```
backend/
├── package.json
├── tsconfig.json
├── prisma/
│   └── schema.prisma
├── src/
│   ├── index.ts
│   ├── config/
│   │   └── index.ts
│   ├── routes/
│   │   ├── kb.ts
│   │   ├── documents.ts
│   │   ├── conversations.ts
│   │   └── chat.ts
│   ├── services/
│   │   ├── coze.ts
│   │   ├── kb.ts
│   │   ├── documents.ts
│   │   └── chat.ts
│   ├── middleware/
│   │   └── error.ts
│   └── utils/
│       └── response.ts
├── .env
└── README.md
```

## 四、数据库设计

### 知识库表

```prisma
model KnowledgeBase {
  id          String   @id @default(uuid())
  name        String
  description String?
  visibility  String   @default("private")
  cozeBotId   String?  // 关联 Coze Bot ID
  documents      Document[]
  conversations  Conversation[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 文档表

```prisma
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
```

### 对话表

```prisma
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
```

### 消息表

```prisma
model Message {
  id              String  @id @default(uuid())
  conversationId  String
  role            String
  content         String
  cozeMessageId   String?  // 关联 Coze 消息 ID
  conversation Conversation @relation(fields: [conversationId], references: [id])
  createdAt DateTime @default(now())
}
```

## 五、API 接口设计

| 方法 | 路径 | 描述 |
|--------|------|-------------|
| GET | `/api/kb` | 获取知识库列表 |
| POST | `/api/kb` | 创建知识库 |
| PATCH | `/api/kb/:id` | 更新知识库 |
| DELETE | `/api/kb/:id` | 删除知识库 |
| GET | `/api/documents?kbId=xxx` | 获取指定知识库的文档列表 |
| POST | `/api/documents` | 上传文档 |
| DELETE | `/api/documents/:id` | 删除文档 |
| GET | `/api/conversations?kbId=xxx` | 获取对话列表 |
| POST | `/api/conversations` | 创建对话 |
| GET | `/api/conversations/:id` | 获取对话详情及消息记录 |
| DELETE | `/api/conversations/:id` | 删除对话 |
| POST | `/api/chat` | 发送消息（SSE 流式响应） |

### 响应格式

```typescript
interface ApiResponse<T> {
  code: number;    // 0 = 成功, 1 = 失败
  data: T;
  message?: string;
}
```

### 对话接口（SSE）

**请求格式**：
```typescript
POST /api/chat
Body: {
  conversationId: string;
  content: string;
  userId?: string;  // 可选，默认 "default_user"
}
```

**响应格式**：Server-Sent Events 流
```
data: {"content": "你好", "done": false}
data: {"content": " 世界", "done": false}
data: {"content": "", "done": true}
```

## 六、Coze API 集成

### SDK 初始化

```typescript
import { CozeAPI, RoleType } from '@coze/api';

const coze = new CozeAPI({
  token: process.env.COZE_API_KEY,
  baseURL: process.env.COZE_BASE_URL || 'https://api.coze.com',
});
```

### 对话流程

1. 用户发送请求到 `POST /api/chat`
2. 从 PostgreSQL 加载对话历史
3. 从知识库记录中获取 Bot ID
4. 调用 Coze API 并启用流式响应
5. 通过 SSE 将响应流式返回给前端
6. 保存用户消息和助手响应到数据库

### 用户标识

由于第一阶段没有认证系统，使用默认用户 ID：
- 默认用户 ID：`"default_user"`（后续可扩展认证系统）
- 每个请求可在 header 或 body 中传递 `userId` 参数

### Coze API 调用示例

```typescript
const stream = await coze.chat({
  bot_id: knowledgeBase.cozeBotId,  // 从知识库记录获取
  user_id: userId,                   // 默认值或从请求获取
  stream: true,
  auto_save_history: true,
  additional_messages: history.map(m => ({
    role: m.role === 'user' ? RoleType.User : RoleType.Assistant,
    content: m.content,
    content_type: 'text',
  })),
});
```

## 七、错误处理

### 全局错误中间件

```typescript
export function errorHandler(err, req, res, next) {
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

### 常见错误类型

| 错误类型 | 状态码 | 描述 |
|-------|--------|-------------|
| 缺少必填字段 | 400 | 请求体缺少必要字段 |
| 对话不存在 | 404 | 对话 ID 不存在 |
| Coze API 调用失败 | 502 | 上游 Coze API 服务异常 |
| 数据库错误 | 500 | PostgreSQL 连接或查询错误 |

## 八、环境变量

```bash
# 数据库配置
DATABASE_URL="postgresql://user:password@localhost:5432/ai_knowledge"

# Coze API 配置
COZE_API_KEY="your_coze_api_key"
COZE_BASE_URL="https://api.coze.com"
COZE_BOT_ID="your_default_bot_id"  # 知识库未配置时的默认 Bot ID
DEFAULT_USER_ID="default_user"     # 第一阶段默认用户 ID

# 服务器配置
PORT=3001
CORS_ORIGIN="http://localhost:3000"
```

## 九、前端集成

### API 基础 URL 更新

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

### Fetch 调用更新

```typescript
// 之前：fetch('/api/kb')
// 之后：fetch(`${API_BASE}/api/kb`)
```

### 流式响应

- 前端当前已使用 SSE 处理对话
- 后端返回相同的 SSE 格式
- 对话流式响应逻辑无需修改

## 十、依赖配置

### package.json

```json
{
  "name": "ai-knowledge-backend",
  "version": "1.0.0",
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

## 十一、实施顺序

1. **项目初始化** - 创建 Express.js + TypeScript 项目
2. **数据库配置** - 设置 Prisma 与 PostgreSQL 表结构
3. **基础接口开发** - 实现知识库、文档、对话的 CRUD 接口
4. **Coze 集成** - 实现流式对话接口
5. **错误处理** - 实现全局错误中间件与标准化响应
6. **前端对接** - 更新前端 API 基础 URL

## 十二、未来规划（第二阶段）

- Coze 知识库管理 API 集成
- 文档上传至 Coze 知识库
- Bot 创建与管理功能
- 实时更新 Webhook 支持