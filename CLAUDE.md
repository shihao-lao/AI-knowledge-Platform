# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 面试知识库智能问答平台 — built with Next.js 16 (App Router) + TypeScript. Prisma (SQLite) + LanceDB backend, local BGE embedding (`bge-small-zh-v1.5`, 512 维) for semantic retrieval, LanceDB FTS (BM25) for lexical retrieval, and Xiaomi MiMo (`mimo-v2.5`) as the LLM. `/api/chat` is a full server-side RAG endpoint (retrieval → history window → streaming → citation extraction → persistence). Supports real user auth, document KBs, structured interview question banks, mock interview mode, answer evaluation and mastery stats.

## Commands

```bash
npm run dev              # Dev server (binds 0.0.0.0)
npm run build            # Production build
npm start                # next start（注意：output=standalone 时请用 start:standalone）
npm run start:standalone # 生产运行：node .next/standalone/server.js
npm test                 # vitest 单元测试
npm run test:pipeline    # RAG 诊断脚本（scripts/test-pipeline.ts）
npm run lint             # ESLint check
npm run format           # Prettier write
npx tsx scripts/reingest-vectors.ts  # 切换 embedding 后重建向量（含文档与题目）
```

## Tech Stack

- **Next.js 16** App Router, React 19, TypeScript (strict)
- **Ant Design 5** (antd + @ant-design/icons) with zh_CN locale + react-19 patch
- **Prisma 5 + SQLite**；**LanceDB** 向量库（表 `knowledge_chunks`，含 `type: 'doc'|'question'` 列）
- **BGE 本地 embedding**（transformers.js/ONNX，首次运行自动下载模型）+ **FTS BM25 混合检索**
- **react-markdown** + remark-gfm + rehype-prism-plus for chat message rendering
- Path alias: `@/*` maps to project root

## Architecture

### Routing

| Route                           | Purpose                                      |
| ------------------------------- | -------------------------------------------- |
| `/`                             | 产品落地页                                   |
| `/login`, `/register`           | 真实认证（HMAC 会话 cookie，proxy.ts 保护） |
| `/knowledge/:kbId`              | 知识管理工作区（三栏）                       |
| `/chat/:kbId/:conversationId`   | 对话工作区（三栏，支持 知识问答/模拟面试）   |
| `/questions/:kbId`              | 面试题库管理（导入/筛选/练习）               |
| `/statistics/:kbId`             | 引用统计 + 练习掌握度                        |
| `/knowledge-bases`              | 知识库管理网格                               |
| `/api/auth/*`                   | 注册/登录/登出/me（公开）                    |
| `/api/chat`                     | 服务端 RAG/面试 SSE 端点（受保护）           |
| `/api/question`, `/api/practice`| 题库与练习评估/统计（受保护）                |

### Key Patterns

- **RAG 在服务端**：`lib/server/rag/chat-service.ts` 编排 归属校验 → 历史（滑动窗口+摘要缓存 `Conversation.summary`）→ 检索 → prompt → 流式 → 引用提取 → 落库。客户端只负责渲染 SSE。
- **认证**：`lib/shared/session-token.ts`（Web Crypto HMAC，Node/Edge 通用）+ `proxy.ts`（Next 16 中间件约定）+ `lib/server/auth.ts`（scrypt 密码哈希、会话、归属校验 helper：`isKnowledgeOwnedBy` / `isConversationOwnedBy`）。
- **Embedding 一致性**：向量表内容必须与 `EMBEDDING_PROVIDER`（bge|local）一致，切换后必须重跑 reingest-vectors。
- **题目卡检索**：Question 入 LanceDB（`type=question`，filename=题干），题干命中高权重由 filename boost 天然实现。
- **LLM_MOCK=1**：离线开发/测试用确定性模拟回答；评估类提示词返回可解析 JSON。

### 目录

```
lib/
  server/          # 服务端专属（禁止客户端 import）
    rag/           # chat-service / history / prompts / citations
    llm/client.ts  # 统一 LLM 客户端（llmChat / llmChatStream，含 mock）
    practice-service.ts  # 答题评估与掌握度统计
    auth.ts        # 密码哈希、会话、归属校验
  shared/          # Node/Edge 通用（session-token）
  db/              # Prisma + Repository（knowledge/document/question）
  embedding/       # bge / local（哈希）provider 切换
  lancedb/         # client / schema / search（混合检索）/ keywords（纯函数）
  services/        # document-service / knowledge-service / question-service
stores/            # knowledge-store（聊天页用本地 state，无 chat-store）
types/             # 前端领域类型；API 类型在 lib/api-client.ts
tests/             # vitest 单元测试（keywords/citations/practice/session/chunker）
scripts/           # reingest-vectors / compare-embedding / smoke-* / sample-questions
```

### 数据模型（prisma/schema.prisma）

`User → Knowledge → (Document → Chunk | Conversation → Message | Question → PracticeRecord)`
所有资源通过 `Knowledge.userId` 归属用户；API 路由全部做 `requireUser` + 归属校验。

## 工作规范（长期约定）

- **小步提交**：每完成一个小的功能/修复就 `git commit` 一次，禁止攒一大批改动后一次性提交。
- **提交描述**：每条 commit 都要写清楚做了什么（type 用 `feat` / `fix` / `refactor` / `chore` / `docs` / `test`），正文用中文简述动机与关键点，必要时附要点列表。
- 示例：`feat(phase-d): 面试题库管理页（列表/筛选/JSON导入/删除）`

## Code Style

- Prettier: single quotes, trailing commas (all), 120 char width, 2 spaces, semicolons
- All components are `'use client'` — no server components beyond layout
- Unused vars: prefix with `_` to suppress warnings
- ESLint flat config with typescript-eslint + react-hooks recommended rules
- 服务端模块统一 `import 'server-only'`；严禁 `NEXT_PUBLIC_` 前缀暴露密钥
