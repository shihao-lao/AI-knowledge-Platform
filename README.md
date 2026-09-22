# AI 面试知识库智能问答平台

基于 RAG（检索增强生成）的知识管理与面试备考系统。上传文档、导入面试题目，通过 AI 对话检索相关资料并生成带引用标注的回答；支持**模拟面试**（AI 面试官逐题问答）、**答题评估**（结构化评分）与**掌握度统计**。

## 技术栈

### 前端

| 层级      | 技术                                            |
| --------- | ----------------------------------------------- |
| 前端框架  | Next.js 16 (App Router) + React 19 + TypeScript |
| UI 组件库 | Ant Design 5 (zh_CN, react-19 patch)            |
| Markdown  | react-markdown + remark-gfm + rehype-prism-plus |

### 后端（Python FastAPI）

| 层级     | 技术                                                    |
| -------- | ------------------------------------------------------- |
| Web 框架 | FastAPI + Uvicorn                                       |
| ORM      | SQLAlchemy 2.0 + Alembic                                |
| 数据库   | PostgreSQL（主数据库）+ Milvus（向量库）+ Redis（缓存） |
| 认证     | JWT + bcrypt 密码哈希                                   |
| LLM 集成 | LangChain + LangGraph + OpenAI 兼容 API                 |
| 文档处理 | unstructured + pypdf + sentence-transformers            |

### 后端（Next.js API 路由 - 可选）

| 层级      | 技术                                                                            |
| --------- | ------------------------------------------------------------------------------- |
| 数据库    | Prisma + SQLite                                                                 |
| 向量库    | LanceDB（BGE 512 维向量 + FTS BM25 混合检索）                                   |
| Embedding | 本地 BGE 中文模型 `bge-small-zh-v1.5`（transformers.js/ONNX，首次运行自动下载） |
| LLM       | 小米 MiMo (mimo-v2.5)，SSE 流式输出；`LLM_MOCK=1` 可离线开发                    |
| 认证      | 自研 HMAC 会话（Web Crypto）+ scrypt 密码哈希，proxy.ts 保护                    |
| 测试      | vitest 单元测试                                                                 |

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

### 方案一：使用 Python 后端（推荐）

#### 环境要求

- Python >= 3.11
- PostgreSQL（可选，生产环境使用）
- Redis（可选，缓存使用）
- Milvus（可选，向量数据库使用）

#### 启动 Python 后端

```bash
# 1. 进入 background 目录
cd background

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等

# 4. 运行数据库迁移（首次运行）
alembic upgrade head

# 5. 启动 FastAPI 应用
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 配置前端连接 Python 后端

在项目根目录创建 `.env.local` 文件：

```env
# 使用 Python 后端
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# 如果要切换回 Next.js API 路由，注释掉上面那行
# NEXT_PUBLIC_API_URL=
```

#### 启动前端

```bash
# 回到项目根目录
cd ..

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

#### 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 方案二：使用 Next.js API 路由

#### 环境要求

- Node.js >= 18
- 首次运行 BGE 模型需联网下载（约 100MB）；国内网络可设置 `HF_ENDPOINT=https://hf-mirror.com` 或让 Node 走本地代理（`HTTPS_PROXY` + `NODE_USE_ENV_PROXY=1`）

#### 安装与配置

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

#### 初始化数据库并启动

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

#### 切换 Embedding 后重建向量

```bash
npx tsx scripts/reingest-vectors.ts   # 删除向量表并重新索引全部文档与题目
```

## 常用脚本

### Python 后端相关

| 命令                                                         | 说明                       |
| ------------------------------------------------------------ | -------------------------- |
| `cd background && uvicorn app.main:app --reload`             | 启动 Python 后端开发服务器 |
| `cd background && alembic upgrade head`                      | 运行数据库迁移             |
| `cd background && alembic revision --autogenerate -m "描述"` | 生成数据库迁移脚本         |
| `cd background && pytest`                                    | 运行 Python 后端测试       |

### Next.js 相关

| 命令                                   | 说明                             |
| -------------------------------------- | -------------------------------- |
| `npm test`                             | vitest 单元测试                  |
| `npm run test:pipeline`                | RAG 管线诊断                     |
| `npx tsx scripts/compare-embedding.ts` | local 与 BGE 语义对比            |
| `npx tsx scripts/reingest-vectors.ts`  | 重建全部向量（文档+题目）        |
| `node scripts/smoke-chat.cjs` 等       | 各功能的冒烟测试（需服务运行中） |

## 主要路由

| 路径                          | 说明                        |
| ----------------------------- | --------------------------- |
| `/knowledge/:kbId`            | 知识管理（三栏工作区）      |
| `/chat/:kbId/:conversationId` | 对话（知识问答 / 模拟面试） |
| `/questions/:kbId`            | 面试题库（导入/筛选/练习）  |
| `/statistics/:kbId`           | 引用统计 + 练习掌握度       |
| `/knowledge-bases`            | 知识库管理网格              |

## API 端点（Python 后端）

### 认证相关

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/logout` - 用户登出
- `GET /api/v1/auth/me` - 获取当前用户信息

### 知识库管理

- `GET /api/v1/knowledge` - 获取知识库列表
- `POST /api/v1/knowledge` - 创建知识库
- `GET /api/v1/knowledge/{id}` - 获取知识库详情
- `PUT /api/v1/knowledge/{id}` - 更新知识库
- `DELETE /api/v1/knowledge/{id}` - 删除知识库
- `GET /api/v1/knowledge/search?q=关键词` - 搜索知识库

### 文档管理

- `GET /api/v1/documents?knowledgeId=xxx` - 获取文档列表
- `POST /api/v1/documents/upload?knowledgeId=xxx` - 上传文档
- `GET /api/v1/documents/{id}` - 获取文档详情
- `DELETE /api/v1/documents/{id}` - 删除文档

### 对话管理

- `GET /api/v1/conversations?knowledgeId=xxx` - 获取对话列表
- `POST /api/v1/conversations?knowledgeId=xxx` - 创建对话
- `GET /api/v1/conversations/{id}` - 获取对话详情
- `DELETE /api/v1/conversations/{id}` - 删除对话
- `GET /api/v1/conversations/{id}/messages` - 获取对话消息
- `POST /api/v1/conversations/{id}/messages` - 添加消息

### 聊天功能

- `POST /api/v1/chat` - RAG 聊天（SSE 流式响应）

### 题库管理

- `GET /api/v1/questions?knowledgeId=xxx` - 获取题目列表
- `POST /api/v1/questions/import?knowledgeId=xxx` - 导入题目
- `GET /api/v1/questions/{id}` - 获取题目详情
- `DELETE /api/v1/questions/{id}` - 删除题目

### 练习功能

- `POST /api/v1/practice/evaluate` - 评估答案
- `GET /api/v1/practice/stats?knowledgeId=xxx` - 获取练习统计

### 简历功能

- `POST /api/v1/resumes/upload` - 上传简历
- `GET /api/v1/resumes` - 获取简历列表
- `GET /api/v1/resumes/{id}` - 获取简历详情

## 项目结构

```
AI-knowledge-Platform/
├── app/                          # Next.js 前端应用
│   ├── api/                      # Next.js API 路由（可选）
│   ├── chat/                     # 对话页面
│   ├── knowledge/                # 知识管理页面
│   ├── questions/                # 题库页面
│   ├── statistics/               # 统计页面
│   └── ...
├── background/                   # Python 后端（FastAPI）
│   ├── app/
│   │   ├── main.py               # FastAPI 入口
│   │   ├── api/routes/           # API 路由
│   │   ├── services/             # 业务服务
│   │   ├── models/               # 数据模型
│   │   ├── infrastructure/       # 基础设施
│   │   ├── core/                 # 核心业务逻辑
│   │   └── etl/                  # ETL 流水线
│   ├── alembic/                  # 数据库迁移
│   ├── requirements.txt          # Python 依赖
│   ├── pyproject.toml            # 项目配置
│   ├── Dockerfile                # Docker 配置
│   └── docker-compose.yml        # Docker Compose
├── lib/                          # 共享库
├── prisma/                       # Prisma 数据库配置
├── scripts/                      # 脚本工具
├── public/                       # 静态资源
└── ...
```

## 部署方式

### 方案一：Docker Compose 部署（推荐）

```bash
# 1. 进入 background 目录
cd background

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 3. 启动所有服务
docker-compose up -d --build

# 4. 查看日志
docker-compose logs -f app
```

### 方案二：手动部署

#### Python 后端部署

```bash
cd background
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 文件
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Next.js 前端部署

```bash
npm install
npm run build
npm run start:standalone
```

## 许可

MIT
