# AI 面试知识库智能问答平台

基于 RAG（检索增强生成）的知识管理与面试备考系统。上传文档、导入面试题目，通过 AI 对话检索相关资料并生成带引用标注的回答；支持**模拟面试**（AI 面试官逐题问答）、**答题评估**（结构化评分）与**掌握度统计**。

## 技术栈

| 层级       | 技术                                                         |
| ---------- | ------------------------------------------------------------ |
| 前端框架   | Next.js 16 (App Router) + React 19 + TypeScript              |
| UI 组件库  | Ant Design 5 (zh_CN, react-19 patch)                         |
| 数据库     | Prisma + SQLite                                              |
| 向量库     | LanceDB（BGE 512 维向量 + FTS BM25 混合检索）                |
| Embedding  | 本地 BGE 中文模型 `bge-small-zh-v1.5`（transformers.js/ONNX，首次运行自动下载） |
| LLM        | 小米 MiMo (mimo-v2.5)，SSE 流式输出；`LLM_MOCK=1` 可离线开发 |
| 认证       | 自研 HMAC 会话（Web Crypto）+ scrypt 密码哈希，proxy.ts 保护 |
| 测试       | vitest 单元测试                                              |
| Markdown   | react-markdown + remark-gfm + rehype-prism-plus              |

## 功能特性

- **用户系统** — 真实注册/登录，全链路数据隔离（每用户独立知识库/文档/题库/对话）
- **知识库管理** — 创建/编辑/删除知识库，文档上传解析（txt/md/pdf/docx/json）与状态追踪
- **语义检索** — 本地 BGE 中文 embedding + LanceDB FTS（BM25）双路 RRF 融合，引用溯源
- **智能对话** — 服务端 RAG：检索 → 历史窗口（超窗自动摘要）→ 流式回答 → 引用校验落库
- **面试题库** — Question 题目卡（类目/难度/关键词/参考答案），JSON 批量导入，题目卡直接参与检索（题干命中高权重）
- **模拟面试** — AI 面试官基于题库逐题提问、点评、总结评分
- **练习评估** — 作答提交后 AI 结构化评分（分数/点评/遗漏要点/参考答案要点），写入练习记录
- **掌握度统计** — 按类目/难度的正确率进度条与最近练习记录

## 快速开始

### 环境要求

- Node.js >= 18
- 首次运行 BGE 模型需联网下载（约 100MB）；国内网络可设置 `HF_ENDPOINT=https://hf-mirror.com` 或让 Node 走本地代理（`HTTPS_PROXY` + `NODE_USE_ENV_PROXY=1`）

### 安装与配置

```bash
npm install
cp .env.example .env
```

编辑 `.env`：

```bash
# Embedding（bge 语义检索，推荐；local 为离线哈希降级）
EMBEDDING_PROVIDER=bge

# 小米 MiMo 大模型（服务端专用，勿用 NEXT_PUBLIC_ 前缀）
MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
MIMO_API_KEY=your_mimo_api_key
MIMO_MODEL=mimo-v2.5

# 会话签名密钥（node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"）
AUTH_SECRET=please-change-me-to-a-long-random-string

# 离线开发：设为 1 使用确定性模拟回答
LLM_MOCK=0
```

### 初始化数据库并启动

```bash
npx prisma migrate deploy
npx prisma generate
npm run dev            # 开发（http://localhost:3000）
```

生产构建与运行：

```bash
npm run build
npm run start:standalone   # node .next/standalone/server.js（output=standalone 必须用此方式）
```

> 注意：`output: 'standalone'` 配置下 `npm start`（next start）不适用，请使用 `start:standalone`。

### 切换 Embedding 后重建向量

```bash
npx tsx scripts/reingest-vectors.ts   # 删除向量表并重新索引全部文档与题目
```

## 常用脚本

| 命令                                      | 说明                             |
| ----------------------------------------- | -------------------------------- |
| `npm test`                                | vitest 单元测试                  |
| `npm run test:pipeline`                   | RAG 管线诊断                     |
| `npx tsx scripts/compare-embedding.ts`    | local 与 BGE 语义对比            |
| `npx tsx scripts/reingest-vectors.ts`     | 重建全部向量（文档+题目）        |
| `node scripts/smoke-chat.cjs` 等           | 各功能的冒烟测试（需服务运行中） |

## 主要路由

| 路径                          | 说明                           |
| ----------------------------- | ------------------------------ |
| `/knowledge/:kbId`            | 知识管理（三栏工作区）         |
| `/chat/:kbId/:conversationId` | 对话（知识问答 / 模拟面试）    |
| `/questions/:kbId`            | 面试题库（导入/筛选/练习）     |
| `/statistics/:kbId`           | 引用统计 + 练习掌握度          |
| `/knowledge-bases`            | 知识库管理网格                 |

## 许可

MIT
