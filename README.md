# AI 知识库智能问答平台

基于 RAG（检索增强生成）的知识管理与智能问答系统。用户上传文档，系统自动解析、分块、向量化存储，随后通过 AI 对话检索相关片段并生成带引用标注的回答。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + React 18 + TypeScript |
| UI 组件库 | Ant Design 5 (zh_CN) |
| 状态管理 | Zustand 5 |
| 数据库 | Prisma + SQLite |
| 向量数据库 | LanceDB |
| 文档解析 | LangChain (pdf-parse / mammoth / exceljs) |
| LLM | 小米 MiMo (mimo-v2.5)，支持 SSE 流式输出 |
| Markdown 渲染 | react-markdown + remark-gfm + rehype-prism-plus |

## 功能特性

- **知识库管理** — 创建、编辑、删除知识库，可视化文档列表与状态追踪
- **文档上传与解析** — 支持 txt / md / pdf / docx / json 格式，自动分块与向量化
- **智能对话** — 基于知识库的 RAG 问答，流式输出，引用来源标注与置信度展示
- **混合搜索** — 向量语义搜索 + 关键词匹配，通过 RRF (Reciprocal Rank Fusion) 融合排序
- **AI 文档摘要** — 自动生成文档摘要与专家 Skill（系统提示词）
- **联网搜索** — 可选 Bing 搜索增强，将网络结果注入对话上下文
- **多种 Embedding** — 支持本地哈希 / TensorFlow / OpenAI / DeepSeek 四种向量化方案

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm 或 npm

### 安装

```bash
git clone <repo-url>
cd AI-knowledge-Platform
npm install
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入以下配置：

```bash
# Embedding 提供商 (openai | deepseek | tensorflow 库处理 )
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key

# 小米 MiMo 大模型
MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
MIMO_API_KEY=your_mimo_api_key
MIMO_MODEL=mimo-v2.5

# 客户端同上（用于 lib/mimo-api.ts）
NEXT_PUBLIC_MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
NEXT_PUBLIC_MIMO_API_KEY=your_mimo_api_key
NEXT_PUBLIC_MIMO_MODEL=mimo-v2.5
```

### 初始化数据库

```bash
npx prisma migrate dev
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 (0.0.0.0) |
| `npm run build` | 生产构建 |
| `npm start` | 启动生产服务器 (0.0.0.0) |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run format:check` | Prettier 检查 |

## 项目结构

```
├── app/
│   ├── api/                    # API 路由
│   │   ├── chat/               # AI 对话（SSE 流式）
│   │   ├── conversation/       # 会话 CRUD
│   │   ├── document/           # 文档管理与上传
│   │   ├── knowledge/          # 知识库 CRUD + 搜索
│   │   └── mimo/               # AI 摘要与 Skill 生成
│   ├── chat/[kbId]/[conversationId]/  # 对话工作区
│   ├── knowledge/[kbId]/       # 知识管理工作区
│   ├── knowledge-bases/        # 知识库管理页
│   ├── login/ & register/      # 登录/注册页
│   └── layout.tsx              # 根布局
├── components/                 # 全局共享组件
├── lib/
│   ├── db/                     # Prisma 客户端与 Repository
│   ├── embedding/              # 向量化提供者（本地/OpenAI/DeepSeek）
│   ├── lancedb/                # LanceDB 连接、Schema、混合搜索
│   ├── parser/                 # 文档解析器
│   ├── rag/                    # 文本分块
│   ├── search/                 # Bing 联网搜索
│   └── services/               # 业务服务层
├── stores/                     # Zustand 状态管理
├── types/                      # TypeScript 类型定义
├── prisma/                     # 数据库 Schema 与迁移
└── data/                       # 运行时数据（向量库、上传文件）
```

## RAG 数据流

```
上传文档 → 解析 (txt/md/pdf/docx/json)
         → 分块 (1000 字符, 200 重叠)
         → 向量化 (Embedding)
         → 存储 (LanceDB)
         → 混合搜索 (向量相似度 + 关键词, RRF 融合)
         → AI 对话 (RAG 上下文注入 → MiMo 流式生成)
```

## Embedding 方案

| 方案 | 维度 | 说明 |
|------|------|------|
| `local` | 512 | 基于字符 n-gram 哈希，无需下载模型 |
| `tensorflow` | 512 | Universal Sentence Encoder |
| `openai` | 1536 | text-embedding-3-small |
| `deepseek` | 1536 | deepseek-embedding |

通过 `EMBEDDING_PROVIDER` 环境变量切换。本地开发推荐使用 `tensorflow` 方案，无需 API Key。

## 路由说明

| 路径 | 说明 |
|------|------|
| `/` | 首页，重定向到默认知识库 |
| `/knowledge/:kbId` | 知识管理工作区（三栏布局） |
| `/chat/:kbId/:conversationId` | 对话工作区（三栏布局） |
| `/knowledge-bases` | 知识库管理网格 |

## 许可

MIT
